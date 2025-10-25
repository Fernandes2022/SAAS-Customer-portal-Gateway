import { Request, Response } from 'express';
import { prisma } from '../prisma';

export class PlansController {
  static async getAllPlans(_req: Request, res: Response) {
    try {
      const plans = await prisma.plan.findMany({
        select: {
          id: true,
          slug: true,
          channelLimit: true,
          uploadQuota: true,
          videoQuota: true,
          podcastQuota: true,
          priceCents: true,
          billingInterval: true,
          stripePriceId: true,
          stripeAnnualPriceId: true,
          hasWatermark: true,
          features: true,
        },
        orderBy: {
          priceCents: 'asc', // Order by price: Free → Pro → Pro+
        },
      });

      // Transform to frontend-friendly format
      const formattedPlans = plans.map((plan) => ({
        id: plan.id,
        slug: plan.slug,
        name: plan.slug === 'free' ? 'Free (Starter)' : 
              plan.slug === 'pro' ? 'Pro (Basic)' : 
              plan.slug === 'pro_plus' ? 'Pro+ (Advanced)' : plan.slug,
        price: plan.priceCents === 0 ? '$0' : `$${(plan.priceCents / 100).toFixed(0)}`,
        priceId: plan.stripePriceId,
        annualPriceId: plan.stripeAnnualPriceId,
        channelLimit: plan.channelLimit,
        uploadQuota: plan.uploadQuota,
        videoQuota: plan.videoQuota,
        podcastQuota: plan.podcastQuota,
        hasWatermark: plan.hasWatermark,
        features: plan.features,
      }));

      res.json({ plans: formattedPlans });
    } catch (error: any) {
      res.status(500).json({ error: 'Failed to fetch plans', details: error.message });
    }
  }
}

