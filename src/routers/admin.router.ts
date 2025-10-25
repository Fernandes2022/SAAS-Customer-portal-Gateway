import { Router } from 'express';
import { requireAuth, requireAdmin, requireAdminRead } from '../middleware/auth';
import { AdminController } from '../controllers/admin.controller';

export const adminRouter = Router();

adminRouter.use(requireAuth);

// Read-only endpoints: allow admin and admin_viewer
adminRouter.get('/users', requireAdminRead, AdminController.listUsers);
adminRouter.get('/jobs', requireAdminRead, AdminController.listJobs);

// Write endpoints: full admin only
// Align with plan wording: suspend/reactivate via POST
adminRouter.post('/user/:id/suspend', requireAdmin, (req, res, next) => {
  // delegate to setStatus with body.status='SUSPENDED'
  req.body = { status: 'SUSPENDED' };
  return AdminController.setStatus(req as any, res).catch(next as any);
});
adminRouter.post('/user/:id/reactivate', requireAdmin, (req, res, next) => {
  req.body = { status: 'ACTIVE' };
  return AdminController.setStatus(req as any, res).catch(next as any);
});
adminRouter.post('/job/:id/retry', requireAdmin, AdminController.retryJob);


