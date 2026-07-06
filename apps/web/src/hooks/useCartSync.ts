'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useCartStore } from '@/store/cartStore';
import type { CartItemLocal } from '@/types/product.types';

export function useCartSync() {
  const { data: session } = useSession();
  const { items, addItem, removeItem, clearCart } = useCartStore();
  const [synced, setSynced] = useState(false);

  // Sync from DB to store on login
  useEffect(() => {
    if (!session?.user.id) {
      // No session → clear store
      clearCart();
      setSynced(true);
      return;
    }

    const syncCartFromDB = async () => {
      try {
        const res = await fetch('/api/cart');
        const json = await res.json();
        if (res.ok && json.data) {
          // Clear local and rebuild from DB
          clearCart();
          json.data.forEach((item: any) => {
            addItem({
              type: item.productId ? 'product' : 'promotion',
              productId: item.productId,
              promotionId: item.promotionId,
              name: item.product?.name || item.promotion?.name || 'Unknown',
              image: item.product?.image || item.promotion?.image,
              unitPrice: Number(item.unitPrice),
              quantity: item.quantity,
              notes: item.notes,
            });
          });
        }
      } catch (err) {
        console.error('Failed to sync cart:', err);
      }
      setSynced(true);
    };

    syncCartFromDB();
  }, [session?.user.id, clearCart, addItem]);

  // Sync to DB whenever items change (debounced)
  useEffect(() => {
    if (!session?.user.id || !synced) return;

    const timer = setTimeout(async () => {
      try {
        await fetch('/api/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items }),
        });
      } catch (err) {
        console.error('Failed to save cart:', err);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [items, session?.user.id, synced]);

  return { synced };
}
