'use client';

import { useCartStore } from '@/store/cartStore';
import { useUIStore } from '@/store/uiStore';
import type { CartItemLocal } from '@/types/product.types';

export function useCart() {
  const store = useCartStore();
  const { openCart } = useUIStore();

  const addAndOpen = (item: Omit<CartItemLocal, 'id'>) => {
    store.addItem(item);
    openCart();
  };

  return {
    items: store.items,
    deliveryFee: store.deliveryFee,
    subtotal: store.subtotal(),
    total: store.total(),
    itemCount: store.itemCount(),
    addItem: store.addItem,
    addItemAndOpen: addAndOpen,
    removeItem: store.removeItem,
    updateQuantity: store.updateQuantity,
    updateNotes: store.updateNotes,
    clearCart: store.clearCart,
    setDeliveryFee: store.setDeliveryFee,
  };
}
