import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database with pricing plans...');

  // Free Plan - Starter tier
  const freePlan = await prisma.plan.upsert({
    where: { slug: 'free' },
    update: {
      channelLimit: 2,
      uploadQuota: 3,  // Total: 2 videos + 1 podcast
      videoQuota: 2,
      podcastQuota: 1,
      priceCents: 0,
      billingInterval: 'monthly',
      stripePriceId: null,
      stripeAnnualPriceId: null,
      hasWatermark: true,
      features: {
        autoReupload: true,
        localization: 'basic', // title/tag only
        analytics: 'basic',
        aiOptimization: false,
        prioritySupport: false,
      },
    },
    create: {
      slug: 'free',
      channelLimit: 2,
      uploadQuota: 3,  // Total: 2 videos + 1 podcast
      videoQuota: 2,
      podcastQuota: 1,
      priceCents: 0,
      billingInterval: 'monthly',
      stripePriceId: null,
      stripeAnnualPriceId: null,
      hasWatermark: true,
      features: {
        autoReupload: true,
        localization: 'basic',
        analytics: 'basic',
        aiOptimization: false,
        prioritySupport: false,
      },
    },
  });
  console.log('✅ Free plan:', freePlan.slug);

  // Pro Plan - Basic tier ($19/month)
  const proPlan = await prisma.plan.upsert({
    where: { slug: 'pro' },
    update: {
      channelLimit: 5,
      uploadQuota: 30,  // Total: 20 videos + 10 podcasts
      videoQuota: 20,
      podcastQuota: 10,
      priceCents: 1900,  // $19.00
      billingInterval: 'monthly',
      stripePriceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || 'price_1SLLnoFQmDN2cIP92C3dcDRC',
      stripeAnnualPriceId: process.env.STRIPE_PRO_ANNUAL_PRICE_ID || null,
      hasWatermark: false,
      features: {
        autoReupload: true,
        localization: 'advanced', // titles, subtitles
        analytics: 'partial',
        aiOptimization: 'basic',
        prioritySupport: 'standard',
      },
    },
    create: {
      slug: 'pro',
      channelLimit: 5,
      uploadQuota: 30,
      videoQuota: 20,
      podcastQuota: 10,
      priceCents: 1900,
      billingInterval: 'monthly',
      stripePriceId: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || 'price_1SLLnoFQmDN2cIP92C3dcDRC',
      stripeAnnualPriceId: process.env.STRIPE_PRO_ANNUAL_PRICE_ID || null,
      hasWatermark: false,
      features: {
        autoReupload: true,
        localization: 'advanced',
        analytics: 'partial',
        aiOptimization: 'basic',
        prioritySupport: 'standard',
      },
    },
  });
  console.log('✅ Pro plan:', proPlan.slug);

  // Pro+ Plan - Advanced tier ($49/month)
  const proPlusPlan = await prisma.plan.upsert({
    where: { slug: 'pro_plus' },
    update: {
      channelLimit: 10,
      uploadQuota: 999999,  // Unlimited (high number)
      videoQuota: null,  // Unlimited (null means no limit)
      podcastQuota: null,
      priceCents: 4900,  // $49.00
      billingInterval: 'monthly',
      stripePriceId: process.env.STRIPE_PRO_PLUS_MONTHLY_PRICE_ID || 'price_1SLLpuFQmDN2cIP95nxDMgys',
      stripeAnnualPriceId: process.env.STRIPE_PRO_PLUS_ANNUAL_PRICE_ID || null,
      hasWatermark: false,
      features: {
        autoReupload: true,
        localization: 'full', // AI translation + SEO
        analytics: 'full',
        aiOptimization: 'full',
        prioritySupport: 'priority',
      },
    },
    create: {
      slug: 'pro_plus',
      channelLimit: 10,
      uploadQuota: 999999,
      videoQuota: null,
      podcastQuota: null,
      priceCents: 4900,
      billingInterval: 'monthly',
      stripePriceId: process.env.STRIPE_PRO_PLUS_MONTHLY_PRICE_ID || 'price_1SLLpuFQmDN2cIP95nxDMgys',
      stripeAnnualPriceId: process.env.STRIPE_PRO_PLUS_ANNUAL_PRICE_ID || null,
      hasWatermark: false,
      features: {
        autoReupload: true,
        localization: 'full',
        analytics: 'full',
        aiOptimization: 'full',
        prioritySupport: 'priority',
      },
    },
  });
  console.log('✅ Pro+ plan:', proPlusPlan.slug);

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

