import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../types/express';
import { PlanService } from '../services/plan.service';

type WindowCounter = { windowStartMs: number; count: number; limit: number };
const counters = new Map<string, WindowCounter>();
const planLimitCache = new Map<string, { limit: number; expiresAt: number }>();

function computeLimitFromPlan(plan: any, defaultLimit: number): number {
  // Basic heuristic to differentiate tiers without strict coupling to schema
  const uploadQuota: number | undefined = plan?.uploadQuota;
  if (typeof uploadQuota === 'number' && Number.isFinite(uploadQuota)) {
    return Math.max(30, Math.min(600, Math.floor(uploadQuota / 10)));
  }
  return defaultLimit;
}

export function rateLimitByPlan(options?: { windowMs?: number; defaultLimit?: number }) {
  const windowMs = options?.windowMs ?? 60_000;
  const defaultLimit = options?.defaultLimit ?? 60;

  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const key = req.auth?.sub || req.ip || 'anon';

      let limit = defaultLimit;
      if (req.auth?.sub) {
        const cacheKey = `plan:${req.auth.sub}`;
        const cached = planLimitCache.get(cacheKey);
        const now = Date.now();
        if (cached && cached.expiresAt > now) {
          limit = cached.limit;
        } else {
          try {
            const plan = await PlanService.getUserPlan(req.auth.sub);
            limit = computeLimitFromPlan(plan, defaultLimit);
          } catch {
            // ignore and keep default limit
          }
          planLimitCache.set(cacheKey, { limit, expiresAt: now + 60_000 });
        }
      }

      const nowMs = Date.now();
      const entry = counters.get(key);
      if (!entry || nowMs - entry.windowStartMs >= windowMs) {
        counters.set(key, { windowStartMs: nowMs, count: 1, limit });
        return next();
      }

      // Update limit if plan changed
      entry.limit = limit;
      if (entry.count >= entry.limit) {
        res.setHeader('Retry-After', Math.ceil((entry.windowStartMs + windowMs - nowMs) / 1000).toString());
        return res.status(429).json({ error: 'Too many requests' });
      }
      entry.count += 1;
      return next();
    } catch (e) {
      // Fail-open on limiter errors
      return next();
    }
  };
}


