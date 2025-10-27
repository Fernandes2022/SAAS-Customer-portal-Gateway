import { Request, Response } from 'express';
import { z } from 'zod';
import { BillingService } from '../services/billing.service';
import { AuthenticatedRequest } from '../types/express';

export class BillingController {
  // Webhook uses raw body; router must provide raw buffer
  static async webhook(req: Request, res: Response) {
    try {
      // @ts-ignore rawBody added by our middleware
      const rawBody: Buffer = req.rawBody;
      const sig = req.headers['stripe-signature'];
      const event = BillingService.verifyWebhook(sig, rawBody);
      await BillingService.handleWebhook(event);
      res.status(200).json({ received: true });
    } catch (e: any) {
      res.status(400).send(`Webhook Error: ${e.message}`);
    }
  }

  static async getPlan(req: AuthenticatedRequest, res: Response) {
    const { plan, usage, channelCount, channelLimit } = await BillingService.getCurrentPlanAndUsage(req.auth!.sub);
    res.json({ plan, usage, channelCount, channelLimit });
  }

  static async createCheckoutSession(req: AuthenticatedRequest, res: Response) {
    const Body = z.object({ priceId: z.string().min(1), successUrl: z.string().url(), cancelUrl: z.string().url() });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const url = await BillingService.createCheckout(req.auth!.sub, parsed.data);
      res.json({ url });
    } catch (e: any) {
      res.status(400).json({ error: e.message || 'Failed to create checkout session' });
    }
  }

  static async createPortalSession(req: AuthenticatedRequest, res: Response) {
    const Body = z.object({ returnUrl: z.string().url() });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    try {
      const url = await BillingService.createPortal(req.auth!.sub, parsed.data.returnUrl);
      res.json({ url });
    } catch (e: any) {
      res.status(400).json({ error: e.message || 'Failed to create portal session' });
    }
  }

  /**
   * Manual sync endpoint - use this when webhooks fail
   * Fetches the user's subscription directly from Stripe and updates the plan
   */
  static async syncPlan(req: AuthenticatedRequest, res: Response) {
    try {
      const result = await BillingService.syncUserPlanFromStripe(req.auth!.sub);
      if (result.success) {
        res.json(result);
      } else {
        res.status(400).json(result);
      }
    } catch (e: any) {
      res.status(500).json({ success: false, error: e.message || 'Failed to sync plan' });
    }
  }

  /**
   * Webhook debugging endpoint - returns recent webhook events for user
   * Helps diagnose why plan updates aren't working
   */
  static async getWebhookEvents(req: AuthenticatedRequest, res: Response) {
    try {
      const { prisma } = await import('../prisma');
      const events = await prisma.webhookEvent.findMany({
        where: { source: 'stripe' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      });
      res.json({ events });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Failed to fetch webhook events' });
    }
  }
}


