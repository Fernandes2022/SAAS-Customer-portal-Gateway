import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/express';
import { AuthService } from '../services/auth.service';

const CredentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100).optional(),
});

export class AuthController {
  static async signup(req: AuthenticatedRequest, res: Response) {
    try {
      const parsed = CredentialsSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      const { email, password, name } = parsed.data;
      const user = await AuthService.signup(email, password, name);
      return res.status(201).json({ id: user.id, email: user.email, name: (user as any).name });
    } catch (err: any) {
      const status = err.status || 500;
      const message = err.message || 'Signup failed';
      return res.status(status).json({ error: message });
    }
  }

  static async login(req: AuthenticatedRequest, res: Response) {
    try {
      const parsed = CredentialsSchema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      const { email, password } = parsed.data;
      const { user, token } = await AuthService.login(email, password);
      return res.json({ token, user: { id: user.id, email: user.email, name: (user as any).name, role: user.role } });
    } catch (err: any) {
      const status = err.status || 500;
      const message = err.message || 'Login failed';
      return res.status(status).json({ error: message });
    }
  }

  static async issueDevToken(req: AuthenticatedRequest, res: Response) {
    if (process.env.NODE_ENV === 'production') return res.status(403).json({ error: 'Disabled in production' });
    const { userId, email, role } = (req.body || {}) as { userId: string; email?: string; role?: 'user' | 'admin' | 'admin_viewer' };
    if (!userId) return res.status(400).json({ error: 'userId is required' });
    const token = AuthService.issueDevToken(userId, email, role ?? 'user');
    return res.json({ token });
  }

  static async forgotPassword(req: AuthenticatedRequest, res: Response) {
    try {
      const schema = z.object({ email: z.string().email() });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      await AuthService.requestPasswordReset(parsed.data.email);
      return res.json({ ok: true });
    } catch (err: any) {
      const status = err.status || 500;
      const message = err.message || 'Password reset request failed';
      return res.status(status).json({ error: message });
    }
  }

  static async resetPassword(req: AuthenticatedRequest, res: Response) {
    try {
      const schema = z.object({ token: z.string().min(1), password: z.string().min(8) });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      await AuthService.resetPassword(parsed.data.token, parsed.data.password);
      return res.json({ ok: true });
    } catch (err: any) {
      const status = err.status || 500;
      const message = err.message || 'Password reset failed';
      return res.status(status).json({ error: message });
    }
  }
}


