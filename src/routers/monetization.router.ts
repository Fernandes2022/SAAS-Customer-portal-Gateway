import { Router } from 'express';
import axios from 'axios';
import { requireAuth } from '../middleware/auth';
import { env } from '../env';

export const monetizationRouter = Router();

// GET /api/v1/monetization → proxy to Bubble workflow
monetizationRouter.use(requireAuth);
monetizationRouter.get('/', async (req, res) => {
  try {
    const userId = (req as any).auth?.sub as string | undefined;
    const response = await axios.get(`${env.BUBBLE_BASE_URL}/api/1.1/wf/monetization`, {
      headers: { Authorization: `Bearer ${env.BUBBLE_API_KEY}` },
      params: { userId },
      timeout: 10_000,
    });
    res.status(200).json(response.data);
  } catch (e: any) {
    res.status(502).json({ error: 'Failed to fetch monetization', detail: e?.message });
  }
});


