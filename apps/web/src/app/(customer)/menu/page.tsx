import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { ProductGrid } from '@/components/products/ProductGrid';
import { DiscountBanner } from '@/components/ui/DiscountBanner';
import { WhatsAppContact } from '@/components/layout/WhatsAppContact';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Menú',
  description: 'Nuestro menú completo de pizzas, empanadas, bebidas y postres',
};

export default function MenuPage() {
  return (
    <Container maxWidth="xl">
      <DiscountBanner />
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          🍕 Nuestro Menú
        </Typography>
        <Typography variant="body1" color="text.secondary" gutterBottom>
          Elegí tus favoritos y hacemos el resto
        </Typography>
        {/* Consultas por WhatsApp: arriba de todo, sin tener que ir al pie. */}
        <WhatsAppContact />
      </Box>
      <ProductGrid />
    </Container>
  );
}
