import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { UserRole } from '@prisma/client';
import { prisma } from '../prisma';
import { env } from '../env';
import { EmailService } from './email.service';

export class AuthService {
  static async signup(email: string, password: string, name?: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      const e = new Error('Email already in use');
      // @ts-ignore
      e.status = 409;
      throw e;
    }
    const passwordHash = await argon2.hash(password);
    const adminEmail = env.ADMIN_EMAIL?.toLowerCase();
    const isAdminEmail = adminEmail && email.toLowerCase() === adminEmail;

    if (isAdminEmail) {
      const adminCreateData: any = { email, passwordHash, role: UserRole.ADMIN };
      if (name) adminCreateData.name = name;
      const [, user] = await prisma.$transaction([
        prisma.user.updateMany({
          where: { role: UserRole.ADMIN, NOT: { email } },
          data: { role: UserRole.USER },
        }),
        prisma.user.create({ data: adminCreateData }),
      ]);
      return user;
    }

    const createData: any = { email, passwordHash, role: UserRole.USER };
    if (name) createData.name = name;
    const user = await prisma.user.create({ data: createData });
    return user;
  }

  static async login(email: string, password: string) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.passwordHash) {
      const e = new Error('Invalid credentials');
      // @ts-ignore
      e.status = 401;
      throw e;
    }
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      const e = new Error('Invalid credentials');
      // @ts-ignore
      e.status = 401;
      throw e;
    }
    // Enforce single-admin policy at login as well
    const adminEmail = env.ADMIN_EMAIL?.toLowerCase();
    if (adminEmail) {
      if (email.toLowerCase() === adminEmail) {
        if (user.role !== UserRole.ADMIN) {
          await prisma.$transaction([
            prisma.user.updateMany({
              where: { role: UserRole.ADMIN, NOT: { email } },
              data: { role: UserRole.USER },
            }),
            prisma.user.update({ where: { id: user.id }, data: { role: UserRole.ADMIN } }),
          ]);
          user.role = UserRole.ADMIN;
        } else {
          // Ensure no other admins exist
          await prisma.user.updateMany({
            where: { role: UserRole.ADMIN, NOT: { email } },
            data: { role: UserRole.USER },
          });
        }
      } else if (user.role === UserRole.ADMIN) {
        // Demote if someone else somehow has admin role
        await prisma.user.update({ where: { id: user.id }, data: { role: UserRole.USER } });
        user.role = UserRole.USER;
      }
    }
    const token = jwt.sign(
      { sub: user.id, email: user.email, role: user.role.toLowerCase() },
      env.JWT_SECRET,
      { audience: env.JWT_AUDIENCE, issuer: env.JWT_ISSUER }
    );
    return { user, token };
  }

  static issueDevToken(userId: string, email?: string, role: 'user' | 'admin' = 'user') {
    return jwt.sign({ sub: userId, email, role }, env.JWT_SECRET, { audience: env.JWT_AUDIENCE, issuer: env.JWT_ISSUER });
  }

  static async requestPasswordReset(email: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { email } });
    // Avoid account enumeration; return success even if user not found
    if (!user) return;

    // Invalidate previous unused tokens
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });

    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    const baseUrl = (env.FRONTEND_BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
    const resetUrl = `${baseUrl}/reset-password?token=${encodeURIComponent(rawToken)}`;

    const html = `
      <p>We received a request to reset your password.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a>. This link will expire in 1 hour.</p>
      <p>If you did not request this, you can ignore this email.</p>
    `;

    await EmailService.send({
      to: user.email,
      subject: 'Reset your password',
      html,
      text: `Reset your password using this link (valid for 1 hour): ${resetUrl}`,
    });
  }

  static async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const tokenRecord = await prisma.passwordResetToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    if (!tokenRecord?.user) {
      const e = new Error('Invalid or expired token');
      // @ts-ignore
      e.status = 400;
      throw e;
    }

    const passwordHash = await argon2.hash(newPassword);
    await prisma.$transaction([
      prisma.user.update({ where: { id: tokenRecord.userId }, data: { passwordHash } }),
      prisma.passwordResetToken.update({ where: { id: tokenRecord.id }, data: { usedAt: new Date() } }),
      prisma.passwordResetToken.deleteMany({ where: { userId: tokenRecord.userId, usedAt: null, expiresAt: { lt: new Date(Date.now() + 365*24*60*60*1000) } } }),
    ]);
  }
}


