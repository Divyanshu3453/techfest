import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

let io;

export function initSocket(server) {
  io = new Server(server, { cors: { origin: process.env.CLIENT_ORIGIN || true } });

  io.use((socket, next) => {
    try {
      socket.user = jwt.verify(socket.handshake.auth?.token, process.env.JWT_SECRET);
      next();
    } catch {
      next(new Error('unauthorized'));
    }
  });

  io.on('connection', (socket) => {
    const u = socket.user;
    socket.join(`user:${u.id}`);
    if (u.role === 'admin') socket.join('admins');
    if (u.role === 'dept_head' && u.head_department) socket.join(`dept:${u.head_department}`);
  });
  return io;
}

export const emitToUser = (id, event, payload) => io?.to(`user:${id}`).emit(event, payload);
export const emitAll = (event, payload) => io?.emit(event, payload);
export const emitToRoom = (room, event, payload) => io?.to(room).emit(event, payload);
