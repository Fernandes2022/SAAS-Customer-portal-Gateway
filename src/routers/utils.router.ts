import { Router } from 'express';
import axios from 'axios';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { env } from '../env';

export const utilsRouter = Router();

// POST /api/v1/translate-preview → Optional localization preview by calling Bubble
utilsRouter.use(requireAuth);
utilsRouter.post('/translate-preview', async (req, res) => {
  const BodySchema = z.object({
    text: z.string().min(1),
    targetLang: z.string().min(2).max(10),
  });
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const response = await axios.post(
      `${env.BUBBLE_BASE_URL}/api/1.1/wf/translate_preview`,
      parsed.data,
      { headers: { Authorization: `Bearer ${env.BUBBLE_API_KEY}` }, timeout: 10_000 }
    );
    res.status(200).json(response.data);
  } catch (e: any) {
    res.status(502).json({ error: 'Failed to fetch translation', detail: e?.message });
  }
});


