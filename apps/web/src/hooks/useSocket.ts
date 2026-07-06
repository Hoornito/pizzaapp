'use client';

import { useEffect, useRef, useState } from 'react';
import { connectSocket, disconnectSocket, getSocket } from '@/lib/socket-client';
import { useNotificationStore } from '@/store/notificationStore';
import { useOrderStore } from '@/store/orderStore';
import type { Socket } from 'socket.io-client';
import type { OrderStatus } from '@prisma/client';

export function useSocket(options?: { joinAdmin?: boolean; joinOrderId?: string }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const initialized = useRef(false);
  const addNotification = useNotificationStore((s) => s.addNotification);
  const updateOrder = useOrderStore((s) => s.updateOrder);
  const addOrder = useOrderStore((s) => s.addOrder);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const s = connectSocket();
    setSocket(s);

    s.on('connect', () => {
      if (options?.joinAdmin) s.emit('join:admin');
      if (options?.joinOrderId) s.emit('join:order', options.joinOrderId);
    });

    s.on('order:new', (order) => {
      addOrder(order as never);
      addNotification({
        title: 'Nuevo pedido',
        body: `Pedido #${order.orderNumber}`,
        type: 'order:new',
      });
    });

    s.on('order:status_updated', (order) => {
      updateOrder(order as never);
    });

    s.on('notification:new', (n) => {
      addNotification(n);
    });

    return () => {
      initialized.current = false;
      disconnectSocket();
    };
  }, []);

  return { socket };
}

export function useOrderSocket(orderId: string, onStatusChange?: (status: OrderStatus) => void) {
  useEffect(() => {
    const socket = connectSocket();

    socket.on('connect', () => {
      socket.emit('join:order', orderId);
    });

    socket.on('order:status', ({ orderId: id, status }) => {
      if (id === orderId && onStatusChange) {
        onStatusChange(status as OrderStatus);
      }
    });

    return () => {
      disconnectSocket();
    };
  }, [orderId]);
}
