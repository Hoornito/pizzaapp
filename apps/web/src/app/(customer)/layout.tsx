'use client';

import Box from '@mui/material/Box';
import { CustomerHeader } from '@/components/layout/CustomerHeader';
import { CustomerFooter } from '@/components/layout/CustomerFooter';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { CartFab } from '@/components/cart/CartFab';
import { useCartSync } from '@/hooks/useCartSync';

// OJO con el overflowX de abajo: va 'clip' y NO 'hidden'. `hidden` convierte al
// contenedor en un scroll container y eso rompe el position:sticky de adentro
// (el header y los tabs del menú dejaban de anclarse). `clip` recorta igual
// pero no scrollea, así el sticky sigue anclando contra la ventana.
export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  useCartSync();
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', overflowX: 'clip' }}>
      <CustomerHeader />
      <Box component="main" sx={{ flexGrow: 1, py: 3, width: '100%', overflowX: 'clip' }}>
        {children}
      </Box>
      <CustomerFooter />
      <CartDrawer />
      <CartFab />
    </Box>
  );
}
