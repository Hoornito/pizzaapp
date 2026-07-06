'use client';

import { useState, useEffect, useCallback } from 'react';
import type { ProductWithCategory, PromotionWithItems } from '@/types/product.types';

export function useProducts(params?: { categoryId?: string; available?: boolean }) {
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = new URLSearchParams();
      if (params?.categoryId) qs.set('categoryId', params.categoryId);
      if (params?.available !== undefined) qs.set('available', String(params.available));
      const res = await fetch(`/api/products?${qs.toString()}`);
      const json = await res.json();
      setProducts(json.data || []);
    } catch (e) {
      setError('Error al cargar productos');
    } finally {
      setLoading(false);
    }
  }, [params?.categoryId, params?.available]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return { products, loading, error, refetch: fetchProducts };
}

export function usePromotions(available?: boolean) {
  const [promotions, setPromotions] = useState<PromotionWithItems[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (available !== undefined) qs.set('available', String(available));
    fetch(`/api/promotions?${qs.toString()}`)
      .then((r) => r.json())
      .then((d) => setPromotions(d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [available]);

  return { promotions, loading };
}

export function useCategories() {
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string; icon?: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => setCategories(d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return { categories, loading };
}
