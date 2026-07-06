import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItemLocal } from '@/types/product.types';

interface CartStore {
  items: CartItemLocal[];
  deliveryFee: number;

  addItem: (item: Omit<CartItemLocal, 'id'>) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateNotes: (id: string, notes: string) => void;
  clearCart: () => void;
  setDeliveryFee: (fee: number) => void;

  subtotal: () => number;
  total: () => number;
  itemCount: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      deliveryFee: 0,

      addItem: (item) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
        // Las docenas de empanadas y las pizzas armadas nunca se fusionan: cada
        // línea lleva su propia composición y debe conservarse por separado.
        const existing = item.dozens || item.pizza
          ? undefined
          : get().items.find(
              (i) =>
                !i.dozens &&
                !i.pizza &&
                ((item.productId && i.productId === item.productId) ||
                  (item.promotionId && i.promotionId === item.promotionId))
            );

        if (existing) {
          set((state) => ({
            items: state.items.map((i) =>
              i.id === existing.id ? { ...i, quantity: i.quantity + item.quantity } : i
            ),
          }));
        } else {
          set((state) => ({ items: [...state.items, { ...item, id }] }));
        }
      },

      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      updateQuantity: (id, quantity) => {
        if (quantity <= 0) {
          get().removeItem(id);
          return;
        }
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, quantity } : i)),
        }));
      },

      updateNotes: (id, notes) =>
        set((state) => ({
          items: state.items.map((i) => (i.id === id ? { ...i, notes } : i)),
        })),

      clearCart: () => set({ items: [], deliveryFee: 0 }),

      setDeliveryFee: (fee) => set({ deliveryFee: fee }),

      subtotal: () =>
        get().items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),

      total: () => get().subtotal() + get().deliveryFee,

      itemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),
    }),
    {
      name: 'pizza-cart',
      partialize: (state) => ({ items: state.items, deliveryFee: state.deliveryFee }),
    }
  )
);
