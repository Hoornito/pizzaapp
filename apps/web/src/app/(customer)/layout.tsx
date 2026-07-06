'use client';

import Box from '@mui/material/Box';
import { CustomerHeader } from '@/components/layout/CustomerHeader';
import { CustomerFooter } from '@/components/layout/CustomerFooter';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { CartFab } from '@/components/cart/CartFab';
import { useCartSync } from '@/hooks/useCartSync';

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  useCartSync();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', overflowX: 'hidden' }}>
      <CustomerHeader />
      <Box component="main" sx={{ flexGrow: 1, py: 3, width: '100%', overflowX: 'hidden' }}>
        {children}
      </Box>
      <CustomerFooter />
      <CartDrawer />
      <CartFab />
    </Box>
  );
}
