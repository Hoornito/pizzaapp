'use client';

import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { usePathname } from 'next/navigation';
import { CustomerHeader } from '@/components/layout/CustomerHeader';
import { CustomerFooter } from '@/components/layout/CustomerFooter';
import { CartDrawer } from '@/components/cart/CartDrawer';
import { CartFab } from '@/components/cart/CartFab';
import { useCartSync } from '@/hooks/useCartSync';
import { InstallPrompt } from '@/components/pwa/InstallPrompt';

// OJO con el overflowX de abajo: va 'clip' y NO 'hidden'. `hidden` convierte al
// contenedor en un scroll container y eso rompe el position:sticky de adentro
// (el header y los tabs del menú dejaban de anclarse). `clip` recorta igual
// pero no scrollea, así el sticky sigue anclando contra la ventana.
export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  useCartSync();
  const pathname = usePathname();
  // En el checkout no molestamos: el cliente está por pagar.
  const ofrecerInstalar = !pathname?.startsWith('/checkout');

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', overflowX: 'clip' }}>
      <CustomerHeader />
      <Box component="main" sx={{ flexGrow: 1, py: 3, width: '100%', overflowX: 'clip' }}>
        {ofrecerInstalar && (
          <Container maxWidth="lg">
            <InstallPrompt />
          </Container>
        )}
        {children}
      </Box>
      <CustomerFooter />
      <CartDrawer />
      <CartFab />
    </Box>
  );
}
