import { Router } from 'express';
import { BillingController } from '../controllers/billing.controller';

export const billingRouter = Router();

// Raw body middleware for Stripe signature verification
billingRouter.post('/webhook/stripe', (req, res, next) => {
  let data = Buffer.alloc(0);
  req.on('data', (chunk) => {
    data = Buffer.concat([data, chunk]);
  });
  req.on('end', () => {
    // @ts-ignore attach raw buffer
    req.rawBody = data;
    next();
  });
}, BillingController.webhook);


