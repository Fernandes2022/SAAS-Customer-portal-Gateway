import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined;
}

// Enhanced PrismaClient configuration with connection pooling and resilience
const createPrismaClient = () => {
  const client = new PrismaClient({
    log: [
      { level: 'warn', emit: 'event' },
      { level: 'error', emit: 'event' },
    ],
    // Connection pool configuration
    // These settings help prevent connection exhaustion
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
  });

  // Log database warnings and errors
  client.$on('warn', (e) => {
    logger.warn({ msg: e.message, target: e.target }, 'Prisma warning');
  });

  client.$on('error', (e) => {
    logger.error({ msg: e.message, target: e.target }, 'Prisma error');
  });

  return client;
};

export const prisma: PrismaClient = global.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  global.prisma = prisma;
}

// Utility function to retry database operations with exponential backoff
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Check if the error is retryable (connection/network issues)
      const isRetryable = 
        error.code === 'P1001' || // Can't reach database server
        error.code === 'P1002' || // Database server timeout
        error.code === 'P1008' || // Operations timed out
        error.code === 'P1017' || // Server closed the connection
        error.code === 'P2024' || // Timed out fetching a connection from the pool
        error.message?.includes('Connection') ||
        error.message?.includes('ECONNREFUSED') ||
        error.message?.includes('ETIMEDOUT') ||
        error.message?.includes('ENOTFOUND');
      
      // Don't retry if it's not a connection issue or we've exhausted retries
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }
      
      // Calculate delay with exponential backoff and jitter
      const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
      
      logger.warn(
        { 
          attempt: attempt + 1, 
          maxRetries, 
          delay,
          errorCode: error.code,
          errorMessage: error.message 
        }, 
        'Database operation failed, retrying...'
      );
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

// Health check function with auto-reconnect capability
export async function ensureDbConnection(): Promise<boolean> {
  try {
    await withRetry(async () => {
      await prisma.$queryRaw`SELECT 1`;
    }, 2, 500);
    return true;
  } catch (error) {
    logger.error({ error }, 'Database connection check failed');
    
    // Attempt to reconnect
    try {
      await prisma.$disconnect();
      await prisma.$connect();
      logger.info('Successfully reconnected to database');
      return true;
    } catch (reconnectError) {
      logger.error({ error: reconnectError }, 'Failed to reconnect to database');
      return false;
    }
  }
}


