import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/express';
import { prisma } from '../prisma';

export class StatusController {
  static async get(req: AuthenticatedRequest, res: Response) {
    const userId = req.auth!.sub;
    const ParamsSchema = z.object({ jobId: z.string().min(1) });
    const parsed = ParamsSchema.safeParse(req.params);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const jobId = parsed.data.jobId;
    const job = await prisma.job.findFirst({ where: { id: jobId, userId } });
    if (!job) return res.status(404).json({ error: 'Not found' });
    return res.json(job);
  }
}


