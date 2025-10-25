import { prisma } from '../prisma';
import { PlanService } from './plan.service';

export class MetricsService {
  static async getOverview(userId: string) {
    const now = new Date();
    const [plan, usage, channelCount, jobStats] = await Promise.all([
      PlanService.getUserPlan(userId),
      PlanService.getCurrentUsage(userId, now),
      PlanService.getUserChannelCount(userId),
      prisma.job.groupBy({
        by: ['status'],
        where: { userId },
        _count: { status: true },
      }),
    ]);

    const channelLimit = plan?.channelLimit ?? PlanService.getDefaultChannelLimitForNoPlan();
    const uploadQuota = plan?.uploadQuota ?? 2; // default free tier
    const uploadsUsed = usage?.uploadsUsed ?? 0;

    const jobCounts: Record<string, number> = {};
    jobStats.forEach((j) => {
      jobCounts[j.status] = j._count.status;
    });

    return {
      platformsConnected: { count: channelCount, limit: channelLimit },
      uploadsThisMonth: { used: uploadsUsed, quota: uploadQuota },
      localizationJobs: {
        queued: jobCounts.QUEUED ?? 0,
        running: jobCounts.RUNNING ?? 0,
        succeeded: jobCounts.SUCCEEDED ?? 0,
        failed: jobCounts.FAILED ?? 0,
      },
      storageUsed: { bytes: 0, limit: 10737418240 }, // placeholder: 10 GB
    };
  }
}

