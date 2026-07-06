'use client';

import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { ProductForm } from '@/components/admin/ProductForm';
import { useSnackbar } from '@/app/snackbar-context';

export default function NewProductPage() {
  const router = useRouter();
  const { showSuccess, showError } = useSnackbar();

  const handleSubmit = async (data: any) => {
    const res = await fetch('/api/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      showError(json.error || 'Error al crear producto');
      return;
    }
    showSuccess('Producto creado');
    router.push('/admin/products');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button onClick={() => router.push('/admin/products')}>← Volver</Button>
        <Typography variant="h4" fontWeight={700}>Nuevo Producto</Typography>
      </Box>
      <ProductForm onSubmit={handleSubmit} />
    </Box>
  );
}
