import type { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { env } from './env';
import { logger } from './logger';

type IoServer = any;
let io: IoServer | null = null;

export function initRealtime(server: HttpServer) {
  try {
    // Dynamically require socket.io to avoid hard dependency
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Server } = require('socket.io');
    io = new Server(server, { cors: { origin: '*', methods: ['GET', 'POST'] } });
    io.on('connection', (socket: any) => {
      try {
        const token = socket.handshake?.auth?.token || socket.handshake?.query?.token;
        if (!token || typeof token !== 'string') {
          socket.disconnect(true);
          return;
        }
        const decoded = jwt.verify(token, env.JWT_SECRET, {
          audience: env.JWT_AUDIENCE,
          issuer: env.JWT_ISSUER,
        }) as { sub: string };
        const userRoom = `user:${decoded.sub}`;
        socket.join(userRoom);
        socket.emit('connected', { ok: true });
      } catch {
        socket.disconnect(true);
      }
    });
    logger.info('Realtime (socket.io) initialized');
  } catch (e) {
    io = null;
    logger.warn('socket.io not installed; realtime disabled');
  }
}

export function emitToUser(userId: string, event: string, payload: unknown) {
  try {
    if (!io) return;
    const room = `user:${userId}`;
    io.to(room).emit(event, payload);
  } catch {}
}


