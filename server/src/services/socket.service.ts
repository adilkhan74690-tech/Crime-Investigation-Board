import { Server as SocketServer } from 'socket.io';
import http from 'http';

let io: SocketServer | null = null;

export const initSocket = (server: http.Server) => {
  io = new SocketServer(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    // Join room for specific officer/user id
    socket.on('authenticate', (userId: string) => {
      socket.join(userId);
      console.log(`[Socket.IO] Client ${socket.id} authenticated as ${userId}`);
    });

    socket.on('disconnect', () => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = (): SocketServer => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

export const emitToUser = (userId: string, event: string, data: any) => {
  if (io) {
    io.to(userId).emit(event, data);
  }
};

export const emitToAll = (event: string, data: any) => {
  if (io) {
    io.emit(event, data);
  }
};
