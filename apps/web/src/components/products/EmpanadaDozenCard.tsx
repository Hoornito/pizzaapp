'use client';

import { useMemo, useState } from 'react';
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
import { usePromotions } from '@/hooks/useProducts';
import { useCart } from '@/hooks/useCart';
import { useSnackbar } from '@/app/snackbar-context';
import { formatCurrency, formatDozensNotes } from '@/lib/utils';
import { EmpanadaDozenModal } from './EmpanadaDozenModal';

/** Id de la promoción "Docena de Empanadas" definida en el seed. */
const DOZEN_PROMO_ID = 'promo-docena-empanadas';

interface EmpanadaDozenCardProps {
  empanadas: ProductWithCategory[];
}

export function EmpanadaDozenCard({ empanadas }: EmpanadaDozenCardProps) {
  const { promotions } = usePromotions(true);
  const { addItemAndOpen } = useCart();
  const { showSuccess } = useSnackbar();
  const [open, setOpen] = useState(false);

  const promo = useMemo(
    () =>
      promotions.find((p) => p.id === DOZEN_PROMO_ID) ||
      promotions.find((p) => /docena/i.test(p.name)),
    [promotions]
  );

  const available = empanadas.filter((e) => e.available);

  // Sin promoción o sin sabores disponibles no tiene sentido mostrar la card.
  if (!promo || available.length === 0) return null;

  const dozenPrice = Number(promo.promotionalPrice);

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
          '&:hover': {
            transform: 'translateY(-4px)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          },
        }}
      >
        <CardMedia
          component="img"
          image={promo.image || '/images/placeholder-pizza.jpg'}
          alt={promo.name}
          sx={{ objectFit: 'cover', height: { xs: 110, sm: 180 } }}
        />
        <CardContent sx={{ flexGrow: 1, p: { xs: 1.25, sm: 2 } }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, gap: 0.5 }}>
            <Typography variant="h6" fontWeight={600} sx={{ fontSize: { xs: '0.9rem', sm: '1rem' }, lineHeight: 1.2 }}>
              {promo.name}
            </Typography>
            <Chip label="Combiná sabores" size="small" color="primary" sx={{ ml: 0.5, flexShrink: 0, display: { xs: 'none', sm: 'flex' } }} />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, display: { xs: 'none', sm: 'block' } }}>
            {promo.description || 'Elegí 12 empanadas y combiná los sabores a tu gusto.'}
          </Typography>
          <Typography color="primary.main" fontWeight={700} sx={{ fontSize: { xs: '0.95rem', sm: '1.25rem' } }}>
            {formatCurrency(dozenPrice)}
            <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
              / docena
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
            Armar docena
          </Button>
        </CardActions>
      </Card>

      <EmpanadaDozenModal
        open={open}
        onClose={() => setOpen(false)}
        empanadas={available}
        dozenPrice={dozenPrice}
        promotionName={promo.name}
        onConfirm={({ dozenCount, dozens, unitPrice }) => {
          addItemAndOpen({
            type: 'promotion',
            promotionId: promo.id,
            name: dozenCount === 1 ? promo.name : `${promo.name} x${dozenCount}`,
            image: promo.image,
            unitPrice,
            quantity: dozenCount,
            dozens,
            notes: formatDozensNotes(dozens),
          });
          setOpen(false);
          showSuccess(
            `${dozenCount} ${dozenCount === 1 ? 'docena agregada' : 'docenas agregadas'} al carrito`
          );
        }}
      />
    </>
  );
}
