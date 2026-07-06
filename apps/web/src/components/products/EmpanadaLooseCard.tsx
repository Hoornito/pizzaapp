'use client';

import { useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import type { ProductWithCategory } from '@/types/product.types';
import { useCart } from '@/hooks/useCart';
import { useUIStore } from '@/store/uiStore';
import { useSnackbar } from '@/app/snackbar-context';
import { formatCurrency, toNumber } from '@/lib/utils';
import { EmpanadaLooseModal } from './EmpanadaLooseModal';

interface EmpanadaLooseCardProps {
  empanadas: ProductWithCategory[];
}

/** Card única "Empanadas sueltas" que abre el modal para sumar por unidad. */
export function EmpanadaLooseCard({ empanadas }: EmpanadaLooseCardProps) {
  const { addItem } = useCart();
  const { openCart } = useUIStore();
  const { showSuccess } = useSnackbar();
  const [open, setOpen] = useState(false);

  const available = empanadas.filter((e) => e.available);
  if (available.length === 0) return null;

  const unitPrice = Math.min(...available.map((e) => toNumber(e.price)));

  return (
    <>
      <Card
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          border: '2px solid',
          borderColor: 'primary.main',
          transition: 'transform 0.2s, box-shadow 0.2s',
          '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' },
        }}
      >
        <CardMedia
          component="img"
          image="/images/placeholder-pizza.jpg"
          alt="Empanadas sueltas"
          sx={{ objectFit: 'cover', height: { xs: 110, sm: 180 } }}
        />
        <CardContent sx={{ flexGrow: 1, p: { xs: 1.25, sm: 2 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, gap: 0.5 }}>
            <Typography variant="h6" fontWeight={600} sx={{ fontSize: { xs: '0.9rem', sm: '1rem' }, lineHeight: 1.2 }}>
              Empanadas sueltas
            </Typography>
            <Chip label="Elegí gustos" size="small" color="primary" sx={{ ml: 0.5, flexShrink: 0, display: { xs: 'none', sm: 'flex' } }} />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, display: { xs: 'none', sm: 'block' } }}>
            Elegí la cantidad de cada gusto. Se cobran por unidad.
          </Typography>
          <Typography color="primary.main" fontWeight={700} sx={{ fontSize: { xs: '0.95rem', sm: '1.25rem' } }}>
            {formatCurrency(unitPrice)}
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
              c/u
            </Typography>
          </Typography>
        </CardContent>
        <CardActions sx={{ p: { xs: 1.25, sm: 2 }, pt: 0 }}>
          <Button
            variant="contained"
            fullWidth
            startIcon={<RestaurantMenuIcon />}
            onClick={() => setOpen(true)}
            sx={{ '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } } }}
          >
            Elegir sueltas
          </Button>
        </CardActions>
      </Card>

      <EmpanadaLooseModal
        open={open}
        onClose={() => setOpen(false)}
        empanadas={available}
        onConfirm={(selection) => {
          selection.forEach((s) =>
            addItem({
              type: 'product',
              productId: s.productId,
              name: s.name,
              image: null,
              unitPrice: s.unitPrice,
              quantity: s.quantity,
            })
          );
          setOpen(false);
          openCart();
          const total = selection.reduce((n, s) => n + s.quantity, 0);
          showSuccess(`${total} ${total === 1 ? 'empanada agregada' : 'empanadas agregadas'} al carrito`);
        }}
      />
    </>
  );
}
