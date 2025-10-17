import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { ChannelsController } from '../controllers/channels.controller';
import { rateLimitByPlan } from '../middleware/rateLimit';

export const channelsRouter = Router();

channelsRouter.use(requireAuth, rateLimitByPlan());
channelsRouter.get('/', ChannelsController.list);
channelsRouter.post('/connect', ChannelsController.connect);


