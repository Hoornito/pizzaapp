'use client';

import { useState } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import {
  PIZZA_SIZES,
  PIZZA_SIZE_LABELS,
  type PizzaSize,
  type ProductWithCategory,
} from '@/types/product.types';
import { sizeRange, flavorsForSize, formatPizzaName, formatPizzaNotes } from '@/lib/pizza';
import { useCart } from '@/hooks/useCart';
import { useUIStore } from '@/store/uiStore';
import { useSnackbar } from '@/app/snackbar-context';
import { formatCurrency } from '@/lib/utils';
import { PizzaModal } from './PizzaModal';

interface PizzaSizeCardsProps {
  /** Productos de la categoría Pizzas (los "gustos"). */
  pizzas: ProductWithCategory[];
}

export function PizzaSizeCards({ pizzas }: PizzaSizeCardsProps) {
  const { addItem } = useCart();
  const { openCart } = useUIStore();
  const { showSuccess } = useSnackbar();
  const [modalSize, setModalSize] = useState<PizzaSize | null>(null);

  // Solo tamaños que tengan al menos un gusto con precio cargado.
  const sizes = PIZZA_SIZES.filter((s) => sizeRange(pizzas, s) !== null);

  if (sizes.length === 0) return null;

  return (
    <>
      {sizes.map((size) => {
          const range = sizeRange(pizzas, size)!;
          return (
            <Grid item xs={6} sm={6} md={4} lg={3} key={size}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  border: '2px solid',
                  borderColor: 'primary.main',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' },
                }}
              >
                <CardMedia
                  component="img"
                  image="/images/placeholder-pizza.jpg"
                  alt={PIZZA_SIZE_LABELS[size]}
                  sx={{ objectFit: 'cover', height: { xs: 110, sm: 180 } }}
                />
                <CardContent sx={{ flexGrow: 1, p: { xs: 1.25, sm: 2 } }}>
                  <Typography variant="h6" fontWeight={600} sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }} gutterBottom>
                    {PIZZA_SIZE_LABELS[size]}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, display: { xs: 'none', sm: 'block' } }}>
                    Elegí el gusto o armala mitad y mitad.
                  </Typography>
                  <Typography color="primary.main" fontWeight={700} sx={{ fontSize: { xs: '0.95rem', sm: '1.25rem' } }}>
                    {range.min === range.max
                      ? formatCurrency(range.min)
                      : `${formatCurrency(range.min)} – ${formatCurrency(range.max)}`}
                  </Typography>
                </CardContent>
                <CardActions sx={{ p: { xs: 1.25, sm: 2 }, pt: 0 }}>
                  <Button
                    variant="contained"
                    fullWidth
                    startIcon={<RestaurantMenuIcon />}
                    onClick={() => setModalSize(size)}
                    sx={{ '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } } }}
                  >
                    Armar
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          );
        })}

      {modalSize && (
        <PizzaModal
          open={modalSize !== null}
          onClose={() => setModalSize(null)}
          size={modalSize}
          flavors={flavorsForSize(pizzas, modalSize)}
          onConfirm={(selected) => {
            selected.forEach((pz) => {
              addItem({
                type: 'product',
                productId: pz.flavors[0].productId,
                name: formatPizzaName(pz),
                image: null,
                unitPrice: pz.price,
                quantity: 1,
                pizza: pz,
                notes: formatPizzaNotes(pz),
              });
            });
            setModalSize(null);
            openCart();
            showSuccess(
              `${selected.length} ${selected.length === 1 ? 'pizza agregada' : 'pizzas agregadas'} al carrito`
            );
          }}
        />
      )}
    </>
  );
}
