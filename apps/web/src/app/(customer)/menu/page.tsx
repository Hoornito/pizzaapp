import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { ProductGrid } from '@/components/products/ProductGrid';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Menú',
  description: 'Nuestro menú completo de pizzas, empanadas, bebidas y postres',
};

export default function MenuPage() {
  return (
    <Container maxWidth="xl">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          🍕 Nuestro Menú
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Elegí tus favoritos y hacemos el resto
        </Typography>
      </Box>
      <ProductGrid />
    </Container>
  );
}
