import { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../env';
import { AuthenticatedRequest, AuthJwtClaims } from '../types/express';

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers['authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = header.substring('Bearer '.length);
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET, {
      audience: env.JWT_AUDIENCE,
      issuer: env.JWT_ISSUER,
    }) as AuthJwtClaims;
    req.auth = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.auth) return res.status(401).json({ error: 'Unauthenticated' });
  if (req.auth.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  return next();
}

export function requireAdminRead(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.auth) return res.status(401).json({ error: 'Unauthenticated' });
  if (req.auth.role !== 'admin' && req.auth.role !== 'admin_viewer') return res.status(403).json({ error: 'Forbidden' });
  return next();
}

export function requireUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.auth) return res.status(401).json({ error: 'Unauthenticated' });
  if (req.auth.role !== 'user') return res.status(403).json({ error: 'Forbidden' });
  return next();
}


