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
    // Idempotency via WebhookEvent table
    const exists = await prisma.webhookEvent.findUnique({ where: { source_eventId: { source: 'stripe', eventId: event.id } } });
    if (exists) return; // already processed
    await prisma.webhookEvent.create({ data: { source: 'stripe', eventId: event.id, status: 'RECEIVED', payload: event as unknown as object } });

    switch (event.type) {
      case 'checkout.session.completed':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        try {
          // Minimal example: assume we stored userId on metadata
          const obj: any = event.data.object as any;
          const userId: string | undefined = obj?.metadata?.userId || obj?.client_reference_id || obj?.customer_email && (await prisma.user.findUnique({ where: { email: obj.customer_email } }))?.id;
          if (userId) {
            let planId: string | null = null;
            if (event.type !== 'customer.subscription.deleted') {
              const priceId: string | undefined = obj?.items?.data?.[0]?.price?.id || obj?.plan?.id || obj?.display_items?.[0]?.plan?.id;
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
              }
            }
            await prisma.user.update({ where: { id: userId }, data: { planId } });
          }
        } catch (e) {
          // swallow to not break webhook handling; tracked via webhookEvent
        }
        break;
      }
      default:
        break;
    }

    await prisma.webhookEvent.update({ where: { source_eventId: { source: 'stripe', eventId: event.id } }, data: { status: 'PROCESSED', processedAt: new Date() } });
  }
}


