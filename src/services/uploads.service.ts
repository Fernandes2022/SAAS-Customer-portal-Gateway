import { prisma } from '../prisma';
import { PlanService } from './plan.service';
import { enqueueUpload } from '../queue';
import { StorageService } from './storage.service';

export class UploadsService {
  static async scheduleUpload(userId: string, input: { channelId: string; assetUrl: string; title: string; description?: string; platform: string; scheduledAt: string }) {
    const channel = await prisma.channel.findFirst({ where: { id: input.channelId, userId } });
    if (!channel) throw new Error('Channel not found');

    await PlanService.ensureWithinLimits(userId);

    const job = await prisma.job.create({
      data: {
        userId,
        channelId: input.channelId,
        assetId: input.assetUrl,
        title: input.title,
        description: input.description,
        platform: input.platform,
        scheduledAt: new Date(input.scheduledAt),
        status: 'QUEUED',
      },
    });

    await enqueueUpload({
      jobId: job.id,
      userId,
      channelId: input.channelId,
      assetUrl: input.assetUrl,
      title: input.title,
      description: input.description,
      platform: input.platform,
      scheduledAt: input.scheduledAt,
    });

    return job;
  }

  static async presignUpload(_userId: string, input: { filename: string; contentType: string }) {
    return StorageService.presignUpload(input);
  }
}


