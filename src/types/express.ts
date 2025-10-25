import type { Request } from 'express';

export interface AuthJwtClaims {
  sub: string; // user id
  email?: string;
  role?: 'user' | 'admin' | 'admin_viewer';
}

export interface AuthenticatedRequest extends Request {
  auth?: AuthJwtClaims;
}


