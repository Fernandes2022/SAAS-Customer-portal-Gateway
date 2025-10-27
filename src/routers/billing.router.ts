import { Router } from 'express';
import express from 'express';
import { BillingController } from '../controllers/billing.controller';
import { requireAuth } from '../middleware/auth';

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

// Authenticated billing endpoints - with JSON parsing
billingRouter.use('/api/v1/billing', express.json({ limit: '2mb' }), requireAuth);
billingRouter.get('/api/v1/billing/plan', (req, res, next) => BillingController.getPlan(req as any, res).catch(next as any));
billingRouter.post('/api/v1/billing/checkout', (req, res, next) => BillingController.createCheckoutSession(req as any, res).catch(next as any));
billingRouter.post('/api/v1/billing/portal', (req, res, next) => BillingController.createPortalSession(req as any, res).catch(next as any));

// Manual sync endpoint - use when webhooks fail
billingRouter.post('/api/v1/billing/sync', (req, res, next) => BillingController.syncPlan(req as any, res).catch(next as any));

// Debug endpoint - view recent webhook events (helpful for troubleshooting)
billingRouter.get('/api/v1/billing/webhooks/debug', (req, res, next) => BillingController.getWebhookEvents(req as any, res).catch(next as any));


