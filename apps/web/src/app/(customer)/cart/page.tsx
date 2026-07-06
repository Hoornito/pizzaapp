'use client';

import { useRouter } from 'next/navigation';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import { useCart } from '@/hooks/useCart';
import { CartItem } from '@/components/cart/CartItem';
import { CartSummary } from '@/components/cart/CartSummary';
import { EmptyState } from '@/components/ui/EmptyState';

export default function CartPage() {
  const router = useRouter();
  const { items, clearCart } = useCart();

  if (items.length === 0) {
    return (
      <Container maxWidth="md">
        <EmptyState
          icon="🛒"
          title="Tu carrito está vacío"
          description="Agregá productos desde el menú para comenzar tu pedido"
          action={{ label: 'Ver menú', href: '/menu' }}
        />
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Mi Carrito
      </Typography>

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Items list */}
        <Box sx={{ flex: 2 }}>
          <Paper sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight={600}>
                {items.length} {items.length === 1 ? 'producto' : 'productos'}
              </Typography>
              <Button size="small" color="error" onClick={clearCart}>
                Vaciar carrito
              </Button>
            </Box>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {items.map((item) => (
                <CartItem key={item.id} item={item} />
              ))}
            </Box>
          </Paper>
        </Box>

        {/* Summary */}
        <Box sx={{ flex: 1, minWidth: 280 }}>
          <Paper sx={{ p: 3, position: 'sticky', top: 80 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>Resumen</Typography>
            <Divider sx={{ mb: 2 }} />
            <CartSummary />
            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={() => router.push('/checkout')}
              sx={{ mt: 2, py: 1.5 }}
            >
              Confirmar pedido →
            </Button>
            <Button
              fullWidth
              onClick={() => router.push('/menu')}
              sx={{ mt: 1 }}
            >
              Seguir comprando
            </Button>
          </Paper>
        </Box>
      </Box>
    </Container>
  );
}
