import { Router } from 'express';
import { requireAuth, requireUser } from '../middleware/auth';
import { UploadsController } from '../controllers/uploads.controller';
import { rateLimitByPlan } from '../middleware/rateLimit';

export const uploadsRouter = Router();

uploadsRouter.use(requireAuth, requireUser, rateLimitByPlan());
uploadsRouter.post('/', UploadsController.create);
uploadsRouter.post('/presign', UploadsController.presign);


