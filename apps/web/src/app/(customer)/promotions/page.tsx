'use client';

import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import { PromotionCard } from '@/components/promotions/PromotionCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { usePromotions } from '@/hooks/useProducts';

export default function PromotionsPage() {
  const { promotions, loading } = usePromotions(true);

  if (loading) return <LoadingSpinner message="Cargando promociones..." />;

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={700} gutterBottom>
          🎁 Promociones
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Las mejores ofertas seleccionadas para vos
        </Typography>
      </Box>

      {promotions.length === 0 ? (
        <EmptyState
          icon="🎁"
          title="No hay promociones activas"
          description="Volvé pronto para ver nuestras ofertas"
        />
      ) : (
        <Grid container spacing={3}>
          {promotions.map((promo) => (
            <Grid item xs={12} sm={6} md={4} key={promo.id}>
              <Box sx={{ position: 'relative' }}>
                <PromotionCard promotion={promo} />
              </Box>
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
}
