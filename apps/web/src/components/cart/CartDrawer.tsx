'use client';

import Drawer from '@mui/material/Drawer';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import CloseIcon from '@mui/icons-material/Close';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import { useRouter } from 'next/navigation';
import { CartItem } from './CartItem';
import { CartSummary } from './CartSummary';
import { useCart } from '@/hooks/useCart';
import { useUIStore } from '@/store/uiStore';
import { EmptyState } from '@/components/ui/EmptyState';

export function CartDrawer() {
  const { items, clearCart } = useCart();
  const { cartOpen, closeCart } = useUIStore();
  const router = useRouter();

  const handleCheckout = () => {
    closeCart();
    router.push('/checkout');
  };

  return (
    <Drawer
      anchor="right"
      open={cartOpen}
      onClose={closeCart}
      PaperProps={{ sx: { width: { xs: '100vw', sm: 420 } } }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', p: 2, borderBottom: '1px solid #e0e0e0' }}>
          <ShoppingCartIcon color="primary" sx={{ mr: 1 }} />
          <Typography variant="h6" fontWeight={700} sx={{ flexGrow: 1 }}>
            Mi Carrito
          </Typography>
          {items.length > 0 && (
            <Button size="small" color="error" onClick={clearCart} sx={{ mr: 1 }}>
              Vaciar
            </Button>
          )}
          <IconButton onClick={closeCart} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        {/* Items */}
        <Box sx={{ flexGrow: 1, overflow: 'auto', p: 2 }}>
          {items.length === 0 ? (
            <EmptyState
              icon="🛒"
              title="Tu carrito está vacío"
              description="Agregá productos del menú para comenzar"
              action={{ label: 'Ver menú', onClick: () => { closeCart(); router.push('/menu'); } }}
            />
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {items.map((item) => (
                <CartItem key={item.id} item={item} />
              ))}
            </Box>
          )}
        </Box>

        {/* Footer */}
        {items.length > 0 && (
          <Box sx={{ p: 2, borderTop: '1px solid #e0e0e0' }}>
            <CartSummary />
            <Button
              variant="contained"
              fullWidth
              size="large"
              onClick={handleCheckout}
              sx={{ mt: 2, py: 1.5, fontSize: '1rem' }}
            >
              Ir a confirmar pedido
            </Button>
            <Button
              variant="text"
              fullWidth
              onClick={() => { closeCart(); router.push('/menu'); }}
              sx={{ mt: 0.5 }}
            >
              ← Seguir comprando
            </Button>
          </Box>
        )}
      </Box>
    </Drawer>
  );
}
