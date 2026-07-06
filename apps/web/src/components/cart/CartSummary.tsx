'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import { useCart } from '@/hooks/useCart';
import { formatCurrency } from '@/lib/utils';

export function CartSummary() {
  const { subtotal, deliveryFee, total } = useCart();

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2" color="text.secondary">Subtotal</Typography>
        <Typography variant="body2">{formatCurrency(subtotal)}</Typography>
      </Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="body2" color="text.secondary">Envío</Typography>
        <Typography variant="body2">
          {deliveryFee === 0 ? 'A confirmar' : formatCurrency(deliveryFee)}
        </Typography>
      </Box>
      <Divider sx={{ my: 1 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="h6" fontWeight={700}>Total</Typography>
        <Typography variant="h6" fontWeight={700} color="primary.main">
          {formatCurrency(total)}
        </Typography>
      </Box>
    </Box>
  );
}
