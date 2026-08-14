'use client';

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface Discount {
  percentage: number;
  label: string;
}

/**
 * Cartel del descuento vigente de la app. Se muestra en el menú y en las
 * pantallas de ingreso/registro, que es donde hay que convencer al cliente de
 * comprar por acá. Si no hay descuento activo no ocupa lugar.
 */
export function DiscountBanner() {
  const [discount, setDiscount] = useState<Discount | null>(null);

  useEffect(() => {
    fetch('/api/settings/discount', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setDiscount(d.data ?? null))
      .catch(() => setDiscount(null));
  }, []);

  if (!discount) return null;

  // El porcentaje se muestra sin decimales cuando es redondo (10%, no 10.00%).
  const pct = Number.isInteger(discount.percentage)
    ? discount.percentage
    : discount.percentage.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');

  return (
    <Box
      role="status"
      sx={{
        mb: 2, px: 2, py: { xs: 1.5, sm: 2 }, borderRadius: 2, textAlign: 'center',
        background: (t) => `linear-gradient(135deg, ${t.palette.primary.main}, ${t.palette.secondary.main})`,
        color: 'common.white',
        boxShadow: 3,
      }}
    >
      <Typography
        variant="h5"
        fontWeight={900}
        sx={{ fontSize: { xs: '1.1rem', sm: '1.6rem' }, lineHeight: 1.15, textTransform: 'uppercase' }}
      >
        {discount.label} · {pct}% de descuento!
      </Typography>
      <Typography variant="caption" sx={{ opacity: 0.9 }}>
        Se aplica solo a los pedidos hechos desde la app
      </Typography>
    </Box>
  );
}
