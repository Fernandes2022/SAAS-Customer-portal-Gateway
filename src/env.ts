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

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET should be at least 16 chars'),
  JWT_ISSUER: z.string().default('customer-portal'),
  JWT_AUDIENCE: z.string().default('customer-portal-clients'),

  BUBBLE_BASE_URL: z.string().url(),
  BUBBLE_API_KEY: z.string().min(1),
  BUBBLE_HEALTH_URL: z.string().url().optional(),

  ENCRYPTION_KEY: z.string().min(32, 'ENCRYPTION_KEY should be 32+ chars'),

  WEBSOCKET_PUBLIC_URL: z.string().url(),

  // Single-admin policy: the email defined here is treated as the only ADMIN
  ADMIN_EMAIL: z.string().email().optional(),

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

