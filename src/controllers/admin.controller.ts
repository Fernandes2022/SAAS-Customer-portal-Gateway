import { Response } from 'express';
import { AuthenticatedRequest } from '../types/express';
import { AdminService } from '../services/admin.service';

export class AdminController {
  static async listUsers(_req: AuthenticatedRequest, res: Response) {
    const users = await AdminService.listUsers();
    res.json(users);
  }
  static async listJobs(_req: AuthenticatedRequest, res: Response) {
    const jobs = await AdminService.listJobs();
    res.json(jobs);
  }
  static async setStatus(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params as { id: string };
    const { status } = req.body as { status: 'ACTIVE' | 'SUSPENDED' };
    if (!status) return res.status(400).json({ error: 'status is required' });
    const updated = await AdminService.setUserStatus(id, status);
    res.json(updated);
  }
  static async retryJob(req: AuthenticatedRequest, res: Response) {
    const { id } = req.params as { id: string };
    const job = await AdminService.retryJob(id);
    res.json(job);
  }
}


