import { create } from 'zustand';
import type { OrderWithRelations } from '@/types/order.types';

interface OrderStore {
  orders: OrderWithRelations[];
  activeOrder: OrderWithRelations | null;
  setOrders: (orders: OrderWithRelations[]) => void;
  setActiveOrder: (order: OrderWithRelations | null) => void;
  updateOrder: (order: OrderWithRelations) => void;
  addOrder: (order: OrderWithRelations) => void;
}

export const useOrderStore = create<OrderStore>((set) => ({
  orders: [],
  activeOrder: null,

  setOrders: (orders) => set({ orders }),

  setActiveOrder: (order) => set({ activeOrder: order }),

  updateOrder: (updated) =>
    set((state) => ({
      orders: state.orders.map((o) => (o.id === updated.id ? updated : o)),
      activeOrder: state.activeOrder?.id === updated.id ? updated : state.activeOrder,
    })),

  addOrder: (order) =>
    set((state) => ({ orders: [order, ...state.orders] })),
}));
