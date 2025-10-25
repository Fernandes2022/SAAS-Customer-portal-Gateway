import { Router } from 'express';
import { requireAuth, requireUser } from '../middleware/auth';
import { StatusController } from '../controllers/status.controller';

export const statusRouter = Router();

statusRouter.use(requireAuth, requireUser);
// Align with plan's job_id param naming while keeping controller agnostic
statusRouter.get('/:job_id', (req, res, next) => {
  // normalize to jobId for controller
  // @ts-ignore
  req.params.jobId = (req.params as any).job_id;
  return StatusController.get(req as any, res).catch(next as any);
});


