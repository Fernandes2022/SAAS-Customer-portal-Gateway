import { Router } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { AdminController } from '../controllers/admin.controller';

export const adminRouter = Router();

adminRouter.use(requireAuth, requireAdmin);
adminRouter.get('/users', AdminController.listUsers);
// Align with plan wording: suspend/reactivate via POST
adminRouter.post('/user/:id/suspend', (req, res, next) => {
  // delegate to setStatus with body.status='SUSPENDED'
  req.body = { status: 'SUSPENDED' };
  return AdminController.setStatus(req as any, res).catch(next as any);
});
adminRouter.post('/user/:id/reactivate', (req, res, next) => {
  req.body = { status: 'ACTIVE' };
  return AdminController.setStatus(req as any, res).catch(next as any);
});
adminRouter.post('/job/:id/retry', AdminController.retryJob);


