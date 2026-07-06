'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { ProductForm } from '@/components/admin/ProductForm';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useSnackbar } from '@/app/snackbar-context';

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditProductPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const { showSuccess, showError } = useSnackbar();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then((r) => r.json())
      .then((d) => setProduct(d.data))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (data: any) => {
    const res = await fetch(`/api/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      showError(json.error || 'Error al actualizar producto');
      return;
    }
    showSuccess('Producto actualizado');
    router.push('/admin/products');
  };

  if (loading) return <LoadingSpinner message="Cargando producto..." />;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button onClick={() => router.push('/admin/products')}>← Volver</Button>
        <Typography variant="h4" fontWeight={700}>Editar Producto</Typography>
      </Box>
      <ProductForm initialData={product} onSubmit={handleSubmit} />
    </Box>
  );
}
