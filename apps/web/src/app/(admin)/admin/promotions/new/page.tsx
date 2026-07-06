'use client';

import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { PromotionForm } from '@/components/admin/PromotionForm';
import { useSnackbar } from '@/app/snackbar-context';

export default function NewPromotionPage() {
  const router = useRouter();
  const { showSuccess, showError } = useSnackbar();

  const handleSubmit = async (data: any) => {
    const res = await fetch('/api/promotions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      showError(json.error || 'Error al crear promoción');
      return;
    }
    showSuccess('Promoción creada');
    router.push('/admin/promotions');
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button onClick={() => router.push('/admin/promotions')}>← Volver</Button>
        <Typography variant="h4" fontWeight={700}>Nueva Promoción</Typography>
      </Box>
      <PromotionForm onSubmit={handleSubmit} />
    </Box>
  );
}
