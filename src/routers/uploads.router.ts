import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { UploadsController } from '../controllers/uploads.controller';
import { rateLimitByPlan } from '../middleware/rateLimit';

export const uploadsRouter = Router();

uploadsRouter.use(requireAuth, rateLimitByPlan());
uploadsRouter.post('/', UploadsController.create);


