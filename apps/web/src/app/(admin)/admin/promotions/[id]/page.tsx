'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { PromotionForm } from '@/components/admin/PromotionForm';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useSnackbar } from '@/app/snackbar-context';

interface Props {
  params: Promise<{ id: string }>;
}

export default function EditPromotionPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const { showSuccess, showError } = useSnackbar();
  const [promotion, setPromotion] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/promotions/${id}`)
      .then((r) => r.json())
      .then((d) => setPromotion(d.data))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmit = async (data: any) => {
    const res = await fetch(`/api/promotions/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    const json = await res.json();
    if (!res.ok) {
      showError(json.error || 'Error al actualizar promoción');
      return;
    }
    showSuccess('Promoción actualizada');
    router.push('/admin/promotions');
  };

  if (loading) return <LoadingSpinner message="Cargando promoción..." />;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button onClick={() => router.push('/admin/promotions')}>← Volver</Button>
        <Typography variant="h4" fontWeight={700}>Editar Promoción</Typography>
      </Box>
      <PromotionForm initialData={promotion} onSubmit={handleSubmit} />
    </Box>
  );
}
