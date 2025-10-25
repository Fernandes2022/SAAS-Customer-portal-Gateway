import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { logger } from './logger';
import { healthRouter } from './routes/health';
import { billingRouter } from './routers/billing.router';
import { adminRouter } from './routers/admin.router';
import { channelsRouter } from './routers/channels.router';
import { uploadsRouter } from './routers/uploads.router';
import { statusRouter } from './routers/status.router';
import { authRouter } from './routers/auth.router';
import { monetizationRouter } from './routers/monetization.router';
import { utilsRouter } from './routers/utils.router';
import { metricsRouter } from './routers/metrics.router';
import { plansRouter } from './routers/plans.router';

export function createServer() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  // Mount Stripe webhook with raw body before JSON parser
  app.use(billingRouter);
  app.use(express.json({ limit: '2mb' }));

  app.use((req, _res, next) => {
    logger.info({ method: req.method, url: req.url }, 'request');
    next();
  });

  app.use('/health', healthRouter);
  app.use('/auth', authRouter);
  app.use(plansRouter); // Public endpoint for viewing plans
  app.use('/api/v1/channels', channelsRouter);
  app.use('/api/v1/upload', uploadsRouter);
  app.use('/api/v1/status', statusRouter);
  app.use('/api/v1/monetization', monetizationRouter);
  app.use('/api/v1/metrics', metricsRouter);
  app.use('/api/v1', utilsRouter); // contains translate-preview
  app.use('/admin', adminRouter);

  app.get('/', (_req, res) => {
    res.send('Gateway up');
  });

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = typeof err?.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
    const message = typeof err?.message === 'string' && err.message ? err.message : 'Internal Server Error';
    logger.error({ err, status }, 'Unhandled error');
    res.status(status).json({ error: message });
  });

  return app;
}


