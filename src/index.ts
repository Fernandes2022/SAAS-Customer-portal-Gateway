import net from 'net';
import { env } from './env';
import { createServer } from './server';
import { logger } from './logger';
import { prisma } from './prisma';
import { initRealtime } from './realtime';
import { initQueue } from './queue';
import { initProviders } from './services/providers/bootstrap';

async function findAvailablePort(startPort: number, maxAttempts = 10): Promise<number> {
  return await new Promise((resolve, reject) => {
    let candidatePort = startPort;
    let attempts = 0;

    const tryPort = () => {
      const tester = net.createServer();
      tester.once('error', (err: any) => {
        tester.close();
        if (
          err && err.code === 'EADDRINUSE' &&
          process.env.NODE_ENV !== 'production' &&
          attempts < maxAttempts
        ) {
          attempts += 1;
          candidatePort += 1;
          logger.warn({ port: candidatePort - 1 }, 'Port in use, trying next');
          tryPort();
          return;
        }
        reject(err);
      });
      tester.once('listening', () => {
        tester.close(() => resolve(candidatePort));
      });
      tester.listen(candidatePort, '0.0.0.0');
    };

    tryPort();
  });
}

async function main() {
  const port = await findAvailablePort(env.PORT);
  const app = createServer();
  const server = app.listen(port, () => {
    logger.info({ port }, 'Gateway listening');
  });
  initRealtime(server);
  initProviders();
  initQueue();

  // Lightweight background health checker (logs only)
  const interval = setInterval(async () => {
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch (e) {
      logger.warn({ e }, 'DB health check failed');
    }
  }, 5 * 60 * 1000);

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    clearInterval(interval);
    server.close(async () => {
      try {
        await prisma.$disconnect();
      } catch {}
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  logger.error({ err }, 'Fatal startup error');
  process.exit(1);
});


