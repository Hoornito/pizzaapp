'use client';

import { useState, useEffect, useCallback } from 'react';
import type { OrderWithRelations } from '@/types/order.types';

export function useOrders(params?: { status?: string }) {
  const [orders, setOrders] = useState<OrderWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (params?.status) qs.set('status', params.status);
      const res = await fetch(`/api/orders?${qs.toString()}`);
      const json = await res.json();
      setOrders(json.data || []);
    } catch {
      setError('Error al cargar pedidos');
    } finally {
      setLoading(false);
    }
  }, [params?.status]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  return { orders, loading, error, refetch: fetchOrders };
}

export function useOrder(id: string) {
  const [order, setOrder] = useState<OrderWithRelations | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    fetch(`/api/orders/${id}`)
      .then((r) => r.json())
      .then((d) => setOrder(d.data || null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  return { order, loading, setOrder };
}
