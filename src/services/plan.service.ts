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

  static async ensureWithinLimits(userId: string) {
    const [plan, usage] = await Promise.all([
      this.getUserPlan(userId),
      this.getCurrentUsage(userId),
    ]);
    if (!plan) return; // free or no plan → allow by default; tighten later if needed
    const uploadsUsed = usage?.uploadsUsed ?? 0;
    if (uploadsUsed >= plan.uploadQuota) {
      const err = new Error('Upload quota exceeded');
      // @ts-ignore
      err.status = 403;
      throw err;
    }
  }

  static async incrementUploadUsage(userId: string, when: Date) {
    // Simple monthly buckets
    const periodStart = new Date(when.getFullYear(), when.getMonth(), 1);
    const periodEnd = new Date(when.getFullYear(), when.getMonth() + 1, 0, 23, 59, 59, 999);
    await prisma.planUsage.upsert({
      where: { userId_periodStart_periodEnd: { userId, periodStart, periodEnd } },
      update: { uploadsUsed: { increment: 1 } },
      create: { userId, periodStart, periodEnd, uploadsUsed: 1, channelsUsed: 0 },
    });
  }
}


