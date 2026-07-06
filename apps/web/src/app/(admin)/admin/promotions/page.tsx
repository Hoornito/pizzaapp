'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Switch from '@mui/material/Switch';
import { formatCurrency } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useSnackbar } from '@/app/snackbar-context';

export default function AdminPromotionsPage() {
  const router = useRouter();
  const { showSuccess, showError } = useSnackbar();
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/promotions')
      .then((r) => r.json())
      .then((d) => setPromotions(d.data || []))
      .finally(() => setLoading(false));
  }, []);

  const toggleActive = async (promo: any) => {
    try {
      const res = await fetch(`/api/promotions/${promo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: !promo.available }),
      });
      if (res.ok) {
        setPromotions((prev) => prev.map((p) => p.id === promo.id ? { ...p, available: !p.available } : p));
        showSuccess(`Promoción ${!promo.available ? 'activada' : 'desactivada'}`);
      }
    } catch {
      showError('Error al actualizar');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta promoción?')) return;
    const res = await fetch(`/api/promotions/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setPromotions((prev) => prev.filter((p) => p.id !== id));
      showSuccess('Promoción eliminada');
    } else {
      showError('Error al eliminar');
    }
  };

  if (loading) return <LoadingSpinner message="Cargando promociones..." />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Promociones</Typography>
        <Button variant="contained" onClick={() => router.push('/admin/promotions/new')}>
          + Nueva promoción
        </Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell><strong>Nombre</strong></TableCell>
              <TableCell><strong>Descripción</strong></TableCell>
              <TableCell align="right"><strong>Precio</strong></TableCell>
              <TableCell align="center"><strong>Items</strong></TableCell>
              <TableCell align="center"><strong>Activa</strong></TableCell>
              <TableCell><strong>Acciones</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {promotions.map((promo) => (
              <TableRow key={promo.id} hover>
                <TableCell>
                  <Typography fontWeight={500}>{promo.name}</Typography>
                </TableCell>
                <TableCell>
                  <Typography variant="body2" color="text.secondary">{promo.description}</Typography>
                </TableCell>
                <TableCell align="right">
                  <Typography fontWeight={600}>{formatCurrency(promo.promotionalPrice)}</Typography>
                </TableCell>
                <TableCell align="center">
                  <Chip label={`${promo._count?.items || promo.items?.length || 0} items`} size="small" />
                </TableCell>
                <TableCell align="center">
                  <Switch
                    checked={promo.available}
                    onChange={() => toggleActive(promo)}
                    color="primary"
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" onClick={() => router.push(`/admin/promotions/${promo.id}`)}>
                      Editar
                    </Button>
                    <Button size="small" color="error" onClick={() => handleDelete(promo.id)}>
                      Eliminar
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
