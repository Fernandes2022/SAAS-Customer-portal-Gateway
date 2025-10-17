import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/express';
import { UploadsService } from '../services/uploads.service';

export class UploadsController {
  static async create(req: AuthenticatedRequest, res: Response) {
    const userId = req.auth!.sub;
    const UploadSchema = z.object({
      channelId: z.string().min(1),
      assetUrl: z.string().url(),
      title: z.string().min(1),
      description: z.string().optional(),
      platform: z.string().min(1),
      scheduledAt: z.string().or(z.date().transform((d) => d.toISOString())),
    });
    const parsed = UploadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const job = await UploadsService.scheduleUpload(userId, parsed.data);
    res.status(201).json(job);
  }
}


