import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/express';
import { ChannelsService } from '../services/channels.service';

export class ChannelsController {
  static async list(req: AuthenticatedRequest, res: Response) {
    const userId = req.auth!.sub;
    const channels = await ChannelsService.listUserChannels(userId);
    res.json(channels);
  }

  static async connect(req: AuthenticatedRequest, res: Response) {
    const userId = req.auth!.sub;
    const ConnectSchema = z.object({
      provider: z.string().min(1),
      providerChannelId: z.string().min(1),
      displayName: z.string().optional(),
    });
    const parsed = ConnectSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const channel = await ChannelsService.connectChannel(userId, parsed.data);
    res.status(201).json(channel);
  }
}


