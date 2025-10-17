import { Request, Response } from 'express';
import { BillingService } from '../services/billing.service';

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
}


