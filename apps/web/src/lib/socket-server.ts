import { Server } from 'socket.io';
import type { Server as HTTPServer } from 'http';
import type {
  ServerToClientEvents,
  ClientToServerEvents,
  InterServerEvents,
  SocketData,
} from '@/types/socket.types';

type IOServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

const globalForIO = globalThis as unknown as { io: IOServer | undefined };

export function initSocketServer(httpServer: HTTPServer): IOServer {
  if (globalForIO.io) return globalForIO.io;

  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(
    httpServer,
    {
      path: '/api/socket',
      cors: {
        origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
    }
  );

  io.on('connection', (socket) => {
    console.log('[Socket.io] Connected:', socket.id);

    socket.on('join:order', (orderId: string) => {
      socket.join(`order:${orderId}`);
    });

    socket.on('join:admin', () => {
      socket.join('admin');
    });

    socket.on('join:print', () => {
      socket.join('print');
    });

    socket.on('disconnect', () => {
      console.log('[Socket.io] Disconnected:', socket.id);
    });
  });

  globalForIO.io = io;
  console.log('[Socket.io] Server initialized');
  return io;
}

export function getIO(): IOServer {
  if (!globalForIO.io) {
    throw new Error('Socket.io server not initialized. Call initSocketServer first.');
  }
  return globalForIO.io;
}

export function emitOrderCreated(order: unknown) {
  try {
    getIO().to('admin').emit('order:new', order as never);
  } catch {}
}

export function emitOrderStatusChanged(orderId: string, status: string, order: unknown) {
  try {
    const io = getIO();
    io.to(`order:${orderId}`).emit('order:status', { orderId, status } as never);
    io.to('admin').emit('order:status_updated', order as never);
  } catch {}
}

export function emitNotification(notification: { title: string; body: string; type: string }) {
  try {
    getIO().to('admin').emit('notification:new', notification);
  } catch {}
}

/** Indica a la estación de impresión que imprima los tickets de un pedido. */
export function emitPrintOrder(orderId: string) {
  try {
    getIO().to('print').emit('print:order', { orderId });
  } catch {}
}
