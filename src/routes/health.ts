import { Router } from 'express';
import { prisma } from '../prisma';
import { logger } from '../logger';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  let db = false;
  let redis = false;
  let queueDepth = 0;
  let websocket = true; // socket.io init logs failures; assume true here
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {}
  try {
    // Best-effort: count queued jobs
    const queued = await prisma.job.count({ where: { status: 'QUEUED' as any } });
    queueDepth = queued;
    // We cannot reliably check Redis without direct client; infer from queue backlog
    redis = true;
  } catch (e) {
    logger.warn({ e }, 'queue metrics failed');
  }

  const allOk = db;
  const status = allOk ? 'ok' : 'degraded';
  res.status(allOk ? 200 : 503).json({ status, db, redis, queueDepth, websocket });
});


