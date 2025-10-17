import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { prisma } from '../prisma';
import { env } from '../env';

export class AuthService {
  static async signup(email: string, password: string) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      const e = new Error('Email already in use');
      // @ts-ignore
      e.status = 409;
      throw e;
    }
    const passwordHash = await argon2.hash(password);
    const user = await prisma.user.create({ data: { email, passwordHash } });
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
}


