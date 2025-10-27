import Stripe from 'stripe';
import { prisma } from '../prisma';
import { env } from '../env';
import { PlanService } from './plan.service';

// Initialize Stripe only if key is available
let stripe: Stripe | null = null;
if (env.STRIPE_SECRET_KEY) {
  stripe = new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2023-10-16' });
}

export class BillingService {
  static async getCurrentPlanAndUsage(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { plan: true } });
    const now = new Date();
    const [usage, channelCount] = await Promise.all([
      prisma.planUsage.findFirst({
        where: { userId, periodStart: { lte: now }, periodEnd: { gte: now } },
        orderBy: { periodStart: 'desc' },
      }),
      PlanService.getUserChannelCount(userId),
    ]);
    const channelLimit = user?.plan?.channelLimit ?? PlanService.getDefaultChannelLimitForNoPlan();
    return { plan: user?.plan ?? null, usage, channelCount, channelLimit };
  }

  static async createCheckout(userId: string, params: { priceId: string; successUrl: string; cancelUrl: string }) {
    if (!env.STRIPE_SECRET_KEY || !stripe) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in your environment variables.');
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    const customerId = await this.upsertStripeCustomer(userId, user.email);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: params.priceId, quantity: 1 }],
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
      client_reference_id: userId,
      metadata: { userId },
    });
    return session.url!;
  }

  static async createPortal(userId: string, returnUrl: string) {
    if (!env.STRIPE_SECRET_KEY || !stripe) {
      throw new Error('Stripe is not configured. Please set STRIPE_SECRET_KEY in your environment variables.');
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    if (!user.stripeCustomerId) {
      throw new Error('No billing history found. Please subscribe to a plan first before managing billing.');
    }
    const portal = await stripe.billingPortal.sessions.create({ customer: user.stripeCustomerId, return_url: returnUrl });
    return portal.url;
  }
  static async upsertStripeCustomer(userId: string, email: string) {
    if (!stripe) throw new Error('Stripe is not configured');
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    if (user.stripeCustomerId) return user.stripeCustomerId;
    const customer = await stripe.customers.create({ email });
    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
    return customer.id;
  }

  static verifyWebhook(signature: string | string[] | undefined, rawBody: Buffer) {
    if (!stripe) throw new Error('Stripe is not configured');
    if (!env.STRIPE_WEBHOOK_SECRET) throw new Error('Missing STRIPE_WEBHOOK_SECRET');
    if (!signature || Array.isArray(signature)) throw new Error('Invalid Stripe signature header');
    return stripe.webhooks.constructEvent(rawBody, signature, env.STRIPE_WEBHOOK_SECRET);
  }

  static async handleWebhook(event: Stripe.Event) {
    console.log(`[WEBHOOK] Received event: ${event.type} (${event.id})`);
    
    // Idempotency via WebhookEvent table
    const exists = await prisma.webhookEvent.findUnique({ where: { source_eventId: { source: 'stripe', eventId: event.id } } });
    if (exists) {
      console.log(`[WEBHOOK] Event already processed: ${event.id}`);
      return; // already processed
    }
    await prisma.webhookEvent.create({ data: { source: 'stripe', eventId: event.id, status: 'RECEIVED', payload: event as unknown as object } });

    switch (event.type) {
      case 'checkout.session.completed':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
      case 'invoice.payment_succeeded': {
        try {
          const obj: any = event.data.object as any;
          let userId: string | undefined = obj?.metadata?.userId || obj?.client_reference_id;
          
          // If no userId, try to find by customer email
          if (!userId && obj?.customer_email) {
            const user = await prisma.user.findUnique({ where: { email: obj.customer_email } });
            userId = user?.id;
          }
          
          // If no userId, try to find by stripe customer ID
          if (!userId && obj?.customer) {
            const user = await prisma.user.findFirst({ where: { stripeCustomerId: obj.customer } });
            userId = user?.id;
          }

          if (userId) {
            console.log(`[WEBHOOK] Found userId: ${userId}`);
            let planId: string | null = null;
            if (event.type !== 'customer.subscription.deleted') {
              let priceId: string | undefined;
              
              // For checkout.session.completed, need to fetch subscription to get price
              if (event.type === 'checkout.session.completed' && obj?.subscription && stripe) {
                console.log(`[WEBHOOK] Fetching subscription: ${obj.subscription}`);
                try {
                  const subscription = await stripe.subscriptions.retrieve(obj.subscription as string);
                  priceId = subscription.items.data[0]?.price?.id;
                  console.log(`[WEBHOOK] Found priceId from subscription: ${priceId}`);
                } catch (e) {
                  console.error('[WEBHOOK] Failed to retrieve subscription:', e);
                }
              }
              
              // For invoice.payment_succeeded, get price from line items
              if (event.type === 'invoice.payment_succeeded' && obj?.lines?.data?.[0]) {
                priceId = obj.lines.data[0].price?.id;
                console.log(`[WEBHOOK] Found priceId from invoice: ${priceId}`);
              }
              
              // For subscription events, get from subscription items
              if (event.type === 'customer.subscription.updated' && obj?.items?.data?.[0]) {
                priceId = obj.items.data[0].price?.id;
                console.log(`[WEBHOOK] Found priceId from subscription items: ${priceId}`);
              }
              
              // Fallback to various locations in the event object
              if (!priceId) {
                priceId = obj?.plan?.id || obj?.display_items?.[0]?.plan?.id;
                if (priceId) {
                  console.log(`[WEBHOOK] Found priceId from event object fallback: ${priceId}`);
                }
              }
              
              if (priceId) {
                // Check both monthly and annual price IDs
                const plan = await prisma.plan.findFirst({ 
                  where: { 
                    OR: [
                      { stripePriceId: priceId },
                      { stripeAnnualPriceId: priceId }
                    ]
                  } 
                });
                planId = plan?.id ?? null;
                
                if (planId) {
                  console.log(`[WEBHOOK] Matched plan: ${plan?.slug} (${planId})`);
                } else {
                  console.error(`[WEBHOOK] No plan found for priceId: ${priceId}`);
                  // Log all available plans to help debug
                  const allPlans = await prisma.plan.findMany({ select: { slug: true, stripePriceId: true, stripeAnnualPriceId: true } });
                  console.error('[WEBHOOK] Available plans:', JSON.stringify(allPlans, null, 2));
                }
              } else {
                console.error('[WEBHOOK] No priceId found in webhook event');
                console.error('[WEBHOOK] Event object keys:', Object.keys(obj));
              }
            }
            console.log(`[WEBHOOK] Updating user ${userId} to planId: ${planId}`);
            await prisma.user.update({ where: { id: userId }, data: { planId } });
            console.log(`[WEBHOOK] ✅ Successfully updated user plan`);
            
            // Mark webhook as successful
            await prisma.webhookEvent.update({ 
              where: { source_eventId: { source: 'stripe', eventId: event.id } }, 
              data: { status: 'PROCESSED', processedAt: new Date() } 
            });
          } else {
            const errorMsg = 'No userId found in webhook event';
            console.error(`[WEBHOOK] ${errorMsg}`);
            console.error('[WEBHOOK] Event object:', JSON.stringify(obj, null, 2));
            
            // Mark as failed for debugging
            await prisma.webhookEvent.update({ 
              where: { source_eventId: { source: 'stripe', eventId: event.id } }, 
              data: { 
                status: 'FAILED', 
                processedAt: new Date(),
                payload: { ...event, error: errorMsg } as any
              } 
            });
          }
        } catch (e: any) {
          console.error('[WEBHOOK] Error handling webhook:', e);
          console.error('[WEBHOOK] Stack trace:', e.stack);
          
          // Mark as failed with error details
          try {
            await prisma.webhookEvent.update({ 
              where: { source_eventId: { source: 'stripe', eventId: event.id } }, 
              data: { 
                status: 'FAILED', 
                processedAt: new Date(),
                payload: { ...event, error: e.message, stack: e.stack } as any
              } 
            });
          } catch (dbError) {
            console.error('[WEBHOOK] Failed to update webhook event in DB:', dbError);
          }
          // Don't throw - return 200 to Stripe to prevent retries
        }
        break;
      }
      default:
        console.log(`[WEBHOOK] Ignoring unhandled event type: ${event.type}`);
        await prisma.webhookEvent.update({ 
          where: { source_eventId: { source: 'stripe', eventId: event.id } }, 
          data: { status: 'PROCESSED', processedAt: new Date() } 
        });
        break;
    }
  }

  /**
   * Manual sync fallback - fetch user's active subscription from Stripe and update plan
   * Use this when webhooks fail or for debugging
   */
  static async syncUserPlanFromStripe(userId: string): Promise<{ success: boolean; message: string; planId?: string | null }> {
    if (!stripe) {
      throw new Error('Stripe is not configured');
    }

    try {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new Error('User not found');
      }

      if (!user.stripeCustomerId) {
        // No Stripe customer = free plan
        await prisma.user.update({ where: { id: userId }, data: { planId: null } });
        return { success: true, message: 'No Stripe customer found. Set to free plan.', planId: null };
      }

      // Fetch all subscriptions for this customer
      const subscriptions = await stripe.subscriptions.list({
        customer: user.stripeCustomerId,
        status: 'active',
        limit: 1,
      });

      if (subscriptions.data.length === 0) {
        // No active subscription = free plan
        await prisma.user.update({ where: { id: userId }, data: { planId: null } });
        return { success: true, message: 'No active subscription found. Set to free plan.', planId: null };
      }

      const subscription = subscriptions.data[0];
      const priceId = subscription.items.data[0]?.price?.id;

      if (!priceId) {
        throw new Error('No price ID found in subscription');
      }

      // Find matching plan
      const plan = await prisma.plan.findFirst({
        where: {
          OR: [
            { stripePriceId: priceId },
            { stripeAnnualPriceId: priceId }
          ]
        }
      });

      const planId = plan?.id ?? null;
      await prisma.user.update({ where: { id: userId }, data: { planId } });

      if (plan) {
        return { 
          success: true, 
          message: `Successfully synced plan: ${plan.slug}`, 
          planId 
        };
      } else {
        return { 
          success: true, 
          message: `Active subscription found but no matching plan for priceId: ${priceId}`, 
          planId: null 
        };
      }
    } catch (error: any) {
      console.error('[SYNC] Error syncing user plan from Stripe:', error);
      return { 
        success: false, 
        message: `Sync failed: ${error.message}` 
      };
    }
  }
}


