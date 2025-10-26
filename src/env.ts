import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { z } from 'zod';

// Load env from current package and, if present, from monorepo root without overriding
const candidateEnvPaths = [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '..', '.env'),
];
for (const envPath of candidateEnvPaths) {
  if (existsSync(envPath)) {
    config({ path: envPath, override: false });
  }
}
  
const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  // DATABASE_URL with connection pooling parameters recommended:
  // postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=20&connect_timeout=10
  // See gateway/DATABASE_CONNECTION_GUIDE.md for detailed configuration
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET should be at least 16 chars'),
  JWT_ISSUER: z.string().default('customer-portal'),
  JWT_AUDIENCE: z.string().default('customer-portal-clients'),

  // Bubble removed

  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY should be 32+ chars'),

  WEBSOCKET_PUBLIC_URL: z.string().url(),

  // Supabase Storage (optional)
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_BUCKET: z.string().optional(),

  // YouTube OAuth (optional for ready-made minimal client)
  YOUTUBE_CLIENT_ID: z.string().optional(),
  YOUTUBE_CLIENT_SECRET: z.string().optional(),
  YOUTUBE_REDIRECT_URI: z.string().url().optional(),

  // Single-admin policy: the email defined here is treated as the only ADMIN
  ADMIN_EMAIL: z.string().email().optional(),
  // Optional: a separate email for a read-only admin viewer
  ADMIN_VIEWER_EMAIL: z.string().email().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  REDIS_URL: z.string().optional(),
  SENTRY_DSN: z.string().optional(),

  // Email (Gmail App Password) / reset password
  GMAIL_USER: z.string().email().optional(),
  GMAIL_APP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().email().optional(),
  FRONTEND_BASE_URL: z.string().url().optional(),
});

export type AppEnv = z.infer<typeof EnvSchema>;

export const env: AppEnv = EnvSchema.parse(process.env);

