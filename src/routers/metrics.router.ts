import { Router } from 'express';
import { requireAuth, requireUser } from '../middleware/auth';
import { MetricsController } from '../controllers/metrics.controller';

export const metricsRouter = Router();

metricsRouter.use(requireAuth, requireUser);
metricsRouter.get('/overview', MetricsController.overview);

