import { prisma } from '../prisma';

export class PlanService {
  static async getUserPlan(userId: string) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { plan: true } });
    return user?.plan ?? null;
  }

  static async getCurrentUsage(userId: string, now: Date = new Date()) {
    const usage = await prisma.planUsage.findFirst({
      where: { userId, periodStart: { lte: now }, periodEnd: { gte: now } },
      orderBy: { periodStart: 'desc' },
    });
    return usage ?? null;
  }

  static async ensureWithinLimits(userId: string, contentType?: 'video' | 'podcast') {
    const [plan, usage] = await Promise.all([
      this.getUserPlan(userId),
      this.getCurrentUsage(userId),
    ]);
    
    // If no plan, apply Free tier limits
    if (!plan) {
      const freeTierLimits = { uploadQuota: 3, videoQuota: 2, podcastQuota: 1 };
      const uploadsUsed = usage?.uploadsUsed ?? 0;
      const videosUsed = usage?.videosUsed ?? 0;
      const podcastsUsed = usage?.podcastsUsed ?? 0;
      
      // Check specific content type limits if provided
      if (contentType === 'video' && videosUsed >= freeTierLimits.videoQuota) {
        const err = new Error('Free tier video limit reached (2/month). Upgrade to Pro for 20 videos/month.');
        // @ts-ignore
        err.status = 403;
        throw err;
      }
      
      if (contentType === 'podcast' && podcastsUsed >= freeTierLimits.podcastQuota) {
        const err = new Error('Free tier podcast limit reached (1/month). Upgrade to Pro for 10 podcasts/month.');
        // @ts-ignore
        err.status = 403;
        throw err;
      }
      
      // Check total upload limit as fallback
      if (uploadsUsed >= freeTierLimits.uploadQuota) {
        const err = new Error('Free tier upload limit reached (2 videos + 1 podcast/month). Upgrade to continue.');
        // @ts-ignore
        err.status = 403;
        throw err;
      }
      return;
    }
    
    // For paid plans, check their specific limits
    const uploadsUsed = usage?.uploadsUsed ?? 0;
    const videosUsed = usage?.videosUsed ?? 0;
    const podcastsUsed = usage?.podcastsUsed ?? 0;
    
    // Check specific content type quotas if they exist
    if (contentType === 'video' && plan.videoQuota !== null && videosUsed >= plan.videoQuota) {
      const err = new Error(`Video upload quota exceeded (${plan.videoQuota}/month). Upgrade for unlimited uploads.`);
      // @ts-ignore
      err.status = 403;
      throw err;
    }
    
    if (contentType === 'podcast' && plan.podcastQuota !== null && podcastsUsed >= plan.podcastQuota) {
      const err = new Error(`Podcast upload quota exceeded (${plan.podcastQuota}/month). Upgrade for unlimited uploads.`);
      // @ts-ignore
      err.status = 403;
      throw err;
    }
    
    // Fall back to total upload quota
    if (uploadsUsed >= plan.uploadQuota) {
      const err = new Error('Upload quota exceeded. Upgrade your plan to continue.');
      // @ts-ignore
      err.status = 403;
      throw err;
    }
  }

  static async incrementUploadUsage(userId: string, when: Date, contentType?: 'video' | 'podcast') {
    // Simple monthly buckets
    const periodStart = new Date(when.getFullYear(), when.getMonth(), 1);
    const periodEnd = new Date(when.getFullYear(), when.getMonth() + 1, 0, 23, 59, 59, 999);
    
    // Prepare update object based on content type
    const updateData: any = { uploadsUsed: { increment: 1 } };
    if (contentType === 'video') {
      updateData.videosUsed = { increment: 1 };
    } else if (contentType === 'podcast') {
      updateData.podcastsUsed = { increment: 1 };
    }
    
    // Prepare create object
    const createData: any = {
      userId,
      periodStart,
      periodEnd,
      uploadsUsed: 1,
      videosUsed: contentType === 'video' ? 1 : 0,
      podcastsUsed: contentType === 'podcast' ? 1 : 0,
      channelsUsed: 0,
    };
    
    await prisma.planUsage.upsert({
      where: { userId_periodStart_periodEnd: { userId, periodStart, periodEnd } },
      update: updateData,
      create: createData,
    });
  }

  // Channel limits
  static getDefaultChannelLimitForNoPlan(): number {
    // Treat users without a paid plan as Free tier
    return 2;
  }

  static async getUserChannelCount(userId: string): Promise<number> {
    return prisma.channel.count({ where: { userId } });
  }

  static async ensureWithinChannelLimit(userId: string) {
    const [plan, channelCount] = await Promise.all([
      this.getUserPlan(userId),
      this.getUserChannelCount(userId),
    ]);
    const limit = plan?.channelLimit ?? this.getDefaultChannelLimitForNoPlan();
    if (channelCount >= limit) {
      const err = new Error('Channel limit reached');
      // @ts-ignore
      err.status = 403;
      throw err;
    }
  }
}


