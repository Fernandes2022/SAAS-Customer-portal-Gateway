import { logger } from './logger';
import { prisma } from './prisma';
import { PlanService } from './services/plan.service';
import axios from 'axios';
import { env } from './env';
import { emitToUser } from './realtime';

type UploadJobPayload = {
  jobId: string;
  userId: string;
  channelId: string;
  assetUrl: string;
  title: string;
  description?: string;
  platform: string;
  scheduledAt: string;
};

type QueueLike = {
  add: (name: string, data: UploadJobPayload, opts?: any) => Promise<void>;
  process?: () => void;
};

let queue: QueueLike | null = null;

export function initQueue() {
  // Sanitize REDIS_URL; users sometimes paste a full CLI command like "redis-cli -u <url>"
  const raw = process.env.REDIS_URL?.trim();
  let redisUrl: string | null = null;
  if (raw && /redis(s)?:\/\//.test(raw)) {
    const token = raw.split(/\s+/).find((t) => /^redis(s)?:\/\//.test(t));
    redisUrl = token || null;
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Queue, Worker, QueueEvents, JobsOptions } = require('bullmq');
    // If redis URL is missing or malformed, prefer in-memory fallback instead of attempting local
    if (!redisUrl) {
      throw new Error('Invalid or missing REDIS_URL');
    }
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const IORedis = require('ioredis');
    const connection = new IORedis(redisUrl);
    connection.on('error', (e: any) => {
      logger.warn({ err: String(e?.message || e) }, 'Redis connection error');
    });
    const uploadQueue = new Queue('uploads', { connection });
    const queueEvents = new QueueEvents('uploads', { connection });
    queueEvents.on('failed', ({ jobId, failedReason }: any) => {
      logger.error({ jobId, failedReason }, 'Upload job failed');
    });
    queue = {
      add: async (_name, data, opts?: any) => {
        const options: typeof JobsOptions = {
          attempts: 5,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: true,
          removeOnFail: false,
          ...opts,
        };
        await uploadQueue.add('upload', data, options);
      },
    };
    const worker = new Worker(
      'uploads',
      async (job: any) => {
        const data = job.data as UploadJobPayload;
        await handleUploadJob(data);
      },
      { connection }
    );
    worker.on('failed', async (job: any, err: any) => {
      if (!job) return;
      const data = job.data as UploadJobPayload;
      await prisma.job.update({ where: { id: data.jobId }, data: { status: 'FAILED', progress: 0, logsJson: { error: String(err?.message || err) }, finishedAt: new Date() } });
      emitToUser(data.userId, 'job:failed', { jobId: data.jobId, error: err?.message || 'failed' });
    });
    logger.info('Queue (BullMQ) initialized');
  } catch (e) {
    logger.warn('Queue not available (bullmq missing or invalid REDIS_URL); using in-memory queue');
    const mem: UploadJobPayload[] = [];
    let running = false;
    async function run() {
      if (running) return;
      running = true;
      while (mem.length > 0) {
        const next = mem.shift()!;
        try {
          await handleUploadJob(next);
        } catch (err) {
          // mark failed
          await prisma.job.update({ where: { id: next.jobId }, data: { status: 'FAILED', finishedAt: new Date(), logsJson: { error: String(err) } } });
        }
      }
      running = false;
    }
    queue = {
      add: async (_name, data) => {
        mem.push(data);
        run().catch(() => {});
      },
    };
  }
}

async function handleUploadJob(data: UploadJobPayload) {
  const { jobId, userId } = data;
  await PlanService.ensureWithinLimits(userId);
  await prisma.job.update({ where: { id: jobId }, data: { status: 'RUNNING', startedAt: new Date(), progress: 1 } });
  emitToUser(userId, 'job:update', { jobId, status: 'RUNNING', progress: 1 });

  await axios.post(`${env.BUBBLE_BASE_URL}/api/1.1/wf/schedule_upload`, { ...data }, {
    headers: { Authorization: `Bearer ${env.BUBBLE_API_KEY}` },
  });

  await prisma.job.update({ where: { id: jobId }, data: { status: 'SUCCEEDED', finishedAt: new Date(), progress: 100 } });
  emitToUser(userId, 'job:done', { jobId, status: 'SUCCEEDED' });
  await PlanService.incrementUploadUsage(userId, new Date(data.scheduledAt));
}

export async function enqueueUpload(data: UploadJobPayload) {
  if (!queue) throw new Error('Queue not initialized');
  await queue.add('upload', data);
}


