import { Router } from 'express';
import axios from 'axios';
import { prisma } from '../prisma';
import { env } from '../env';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  let db = false;
  let bubble = false;
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = true;
  } catch {}
  try {
    const url = env.BUBBLE_HEALTH_URL || env.BUBBLE_BASE_URL;
    const resp = await axios.get(url, { headers: { Authorization: `Bearer ${env.BUBBLE_API_KEY}` }, timeout: 5000, validateStatus: () => true });
    // Consider any network success and non-5xx as reachable
    bubble = resp.status < 500;
  } catch {}

  const allOk = db && bubble;
  const status = allOk ? 'ok' : 'degraded';
  res.status(allOk ? 200 : 503).json({ status, db, bubble });
});


