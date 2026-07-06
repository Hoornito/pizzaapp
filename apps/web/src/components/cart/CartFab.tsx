'use client';

import Fab from '@mui/material/Fab';
import Badge from '@mui/material/Badge';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import Box from '@mui/material/Box';
import { useCartStore } from '@/store/cartStore';
import { useUIStore } from '@/store/uiStore';

export function CartFab() {
  const itemCount = useCartStore((s) => s.itemCount());
  const { toggleCart } = useUIStore();

  if (itemCount === 0) return null;

  return (
    <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}>
      <Fab
        color="primary"
        onClick={toggleCart}
        aria-label="Ver carrito"
        sx={{ boxShadow: '0 4px 20px rgba(198,40,40,0.4)' }}
      >
        <Badge badgeContent={itemCount} color="secondary">
          <ShoppingCartIcon />
        </Badge>
      </Fab>
    </Box>
  );
}
