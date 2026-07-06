import type { OrderStatus } from '@prisma/client';
import type { OrderWithRelations } from './order.types';

export interface ServerToClientEvents {
  'order:new': (order: OrderWithRelations) => void;
  'order:status': (data: { orderId: string; status: OrderStatus }) => void;
  'order:status_updated': (order: OrderWithRelations) => void;
  'notification:new': (notification: { title: string; body: string; type: string }) => void;
  // Pedido a imprimir: lo recibe la "estación de impresión" (PC con QZ Tray).
  'print:order': (data: { orderId: string }) => void;
}

export interface ClientToServerEvents {
  'join:order': (orderId: string) => void;
  'join:admin': () => void;
  // La estación de impresión se une a su sala para recibir 'print:order'.
  'join:print': () => void;
}

export interface InterServerEvents {
  ping: () => void;
}

export interface SocketData {
  userId?: string;
  role?: string;
}
