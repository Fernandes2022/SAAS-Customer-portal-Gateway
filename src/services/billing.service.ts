import Stripe from 'stripe';
import { prisma } from '../prisma';
import { env } from '../env';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' });

export class BillingService {
  static async upsertStripeCustomer(userId: string, email: string) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found');
    if (user.stripeCustomerId) return user.stripeCustomerId;
    const customer = await stripe.customers.create({ email });
    await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
    return customer.id;
  }

  static verifyWebhook(signature: string | string[] | undefined, rawBody: Buffer) {
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
                const plan = await prisma.plan.findFirst({ where: { stripePriceId: priceId } });
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


