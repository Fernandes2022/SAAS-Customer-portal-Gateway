/**
 * Debug script to check and manually update user plans
 * Run with: npx ts-node debug-plan.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('\n=== USERS AND PLANS ===\n');
  
  const users = await prisma.user.findMany({
    include: { plan: true },
    orderBy: { createdAt: 'desc' }
  });

  for (const user of users) {
    console.log(`User: ${user.email}`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Plan: ${user.plan?.slug || 'No plan (Free tier)'}`);
    console.log(`  Stripe Customer ID: ${user.stripeCustomerId || 'Not set'}`);
    console.log('');
  }

  console.log('\n=== AVAILABLE PLANS ===\n');
  
  const plans = await prisma.plan.findMany({
    orderBy: { priceCents: 'asc' }
  });

  for (const plan of plans) {
    console.log(`Plan: ${plan.slug}`);
    console.log(`  ID: ${plan.id}`);
    console.log(`  Price ID (Monthly): ${plan.stripePriceId || 'Not set'}`);
    console.log(`  Price ID (Annual): ${plan.stripeAnnualPriceId || 'Not set'}`);
    console.log('');
  }

  console.log('\n=== RECENT WEBHOOK EVENTS ===\n');
  
  const webhookEvents = await prisma.webhookEvent.findMany({
    where: { source: 'stripe' },
    orderBy: { createdAt: 'desc' },
    take: 5
  });

  for (const event of webhookEvents) {
    const payload: any = event.payload;
    console.log(`Event: ${payload.type || 'Unknown'}`);
    console.log(`  ID: ${event.eventId}`);
    console.log(`  Status: ${event.status}`);
    console.log(`  Created: ${event.createdAt}`);
    if (event.errorMessage) {
      console.log(`  Error: ${event.errorMessage}`);
    }
    console.log('');
  }

  // Prompt to update a user's plan
  console.log('\n=== TO MANUALLY UPDATE A USER PLAN ===');
  console.log('Run: npx ts-node debug-plan.ts <userEmail> <planSlug>');
  console.log('Example: npx ts-node debug-plan.ts user@example.com pro\n');

  const userEmail = process.argv[2];
  const planSlug = process.argv[3];

  if (userEmail && planSlug) {
    const user = await prisma.user.findUnique({ where: { email: userEmail } });
    if (!user) {
      console.error(`❌ User not found: ${userEmail}`);
      process.exit(1);
    }

    const plan = await prisma.plan.findUnique({ where: { slug: planSlug } });
    if (!plan) {
      console.error(`❌ Plan not found: ${planSlug}`);
      console.log('Available plans:', plans.map(p => p.slug).join(', '));
      process.exit(1);
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { planId: plan.id }
    });

    console.log(`✅ Updated ${userEmail} to ${planSlug} plan!`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });

