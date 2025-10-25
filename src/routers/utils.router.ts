import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';

export const utilsRouter = Router();

// POST /api/v1/translate-preview → Optional localization preview (local no-op)
utilsRouter.use(requireAuth);
utilsRouter.post('/translate-preview', async (req, res) => {
  const BodySchema = z.object({
    text: z.string().min(1),
    targetLang: z.string().min(2).max(10),
  });
  const parsed = BodySchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  // Simple echo for now; replace with real translation provider if needed
  const { text, targetLang } = parsed.data;
  res.status(200).json({ text, targetLang, translated: text });
});


