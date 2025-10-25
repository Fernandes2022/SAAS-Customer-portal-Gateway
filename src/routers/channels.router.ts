import { Router } from 'express';
import { requireAuth, requireUser } from '../middleware/auth';
import { ChannelsController } from '../controllers/channels.controller';
import { rateLimitByPlan } from '../middleware/rateLimit';

export const channelsRouter = Router();

channelsRouter.use(requireAuth, requireUser, rateLimitByPlan());
channelsRouter.get('/', ChannelsController.list);
channelsRouter.post('/connect', ChannelsController.connect);
channelsRouter.post('/refresh-all', ChannelsController.refreshAll);
channelsRouter.delete('/:id', ChannelsController.disconnect);
channelsRouter.post('/:id/refresh', ChannelsController.refresh);


