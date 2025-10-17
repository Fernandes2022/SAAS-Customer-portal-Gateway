import { prisma } from '../prisma';
import { enqueueUpload } from '../queue';

export class AdminService {
  static listUsers() {
    return prisma.user.findMany({ select: { id: true, email: true, role: true, status: true, planId: true } });
  }
  static async setUserStatus(userId: string, status: 'ACTIVE' | 'SUSPENDED') {
    return prisma.user.update({ where: { id: userId }, data: { status } });
  }
  static async retryJob(jobId: string) {
    const job = await prisma.job.findUnique({ where: { id: jobId } });
    if (!job) throw new Error('Job not found');
    if (job.status === 'RUNNING') return job;
    await prisma.job.update({ where: { id: jobId }, data: { status: 'QUEUED', progress: 0, startedAt: null, finishedAt: null } });
    await enqueueUpload({
      jobId: job.id,
      userId: job.userId,
      channelId: job.channelId,
      assetUrl: job.assetId || '',
      title: job.title,
      description: job.description || undefined,
      platform: job.platform,
      scheduledAt: job.scheduledAt.toISOString(),
    });
    return await prisma.job.findUnique({ where: { id: jobId } });
  }
}


