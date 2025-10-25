import { Router } from 'express';
import { requireAuth, requireUser } from '../middleware/auth';
import { prisma } from '../prisma';

export const monetizationRouter = Router();

// GET /api/v1/monetization → internal aggregation over recent jobs
monetizationRouter.use(requireAuth, requireUser);
monetizationRouter.get('/', async (req, res) => {
  try {
    const userId = (req as any).auth?.sub as string;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [total, succeeded, failed] = await Promise.all([
      prisma.job.count({ where: { userId, createdAt: { gte: since } } }),
      prisma.job.count({ where: { userId, createdAt: { gte: since }, status: 'SUCCEEDED' as any } }),
      prisma.job.count({ where: { userId, createdAt: { gte: since }, status: 'FAILED' as any } }),
    ]);
    const byPlatform = await prisma.job.groupBy({
      by: ['platform'],
      where: { userId, createdAt: { gte: since } },
      _count: { _all: true },
    });
    res.status(200).json({ total, succeeded, failed, byPlatform });
  } catch (e: any) {
    res.status(502).json({ error: 'Failed to fetch monetization', detail: e?.message });
  }
});


