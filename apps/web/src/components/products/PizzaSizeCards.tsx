'use client';

import { useState, type KeyboardEvent } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import RestaurantMenuIcon from '@mui/icons-material/RestaurantMenu';
import {
  PIZZA_SIZES,
  PIZZA_SIZE_LABELS,
  type PizzaSize,
  type ProductWithCategory,
} from '@/types/product.types';
import { sizeRange } from '@/lib/pizza';
import { useCart } from '@/hooks/useCart';
import { useUIStore } from '@/store/uiStore';
import { formatCurrency } from '@/lib/utils';
import { PizzaCounterModal, type PizzaMode } from './PizzaCounterModal';
import { ProductDetailModal } from './ProductDetailModal';

interface PizzaSizeCardsProps {
  /** Productos de la categoría Pizzas (los "gustos"). */
  pizzas: ProductWithCategory[];
  /**
   * Mostrar solo la card de "Mitad y mitad". Los tamaños sueltos ya no hacen
   * falta en el menú: cada gusto tiene su card y el tamaño se elige adentro.
   */
  onlyHalf?: boolean;
}

/** Una card por tamaño + la de mitad y mitad. */
interface PizzaEntry {
  mode: PizzaMode;
  title: string;
  description: string;
  /** Precio de referencia y su aclaración. */
  price: number | null;
  priceNote: string | null;
  action: string;
}

const SIZE_DESCRIPTION: Record<PizzaSize, string> = {
  SMALL: 'Pizza individual, ideal para una persona. Elegí la cantidad de cada gusto.',
  MEDIUM: 'Pizza mediana, para compartir entre dos. Elegí la cantidad de cada gusto.',
  LARGE: 'Pizza grande, la que más rinde. Elegí la cantidad de cada gusto.',
};

const PLACEHOLDER = '/images/placeholder-pizza.jpg';

export function PizzaSizeCards({ pizzas, onlyHalf }: PizzaSizeCardsProps) {
  const { addItem } = useCart();
  const { openCart } = useUIStore();
  // Panel de armado abierto (con el tamaño ya fijado por la card).
  const [building, setBuilding] = useState<PizzaEntry | null>(null);
  // Ficha de la card (se abre tocando la foto).
  const [detail, setDetail] = useState<PizzaEntry | null>(null);

  // Solo tamaños que tengan al menos un gusto con precio cargado.
  const sizes = PIZZA_SIZES.filter((s) => sizeRange(pizzas, s) !== null);
  if (sizes.length === 0) return null;

  const entries: PizzaEntry[] = (onlyHalf ? [] : sizes).map((size) => {
    const range = sizeRange(pizzas, size)!;
    return {
      mode: size,
      title: PIZZA_SIZE_LABELS[size],
      description: SIZE_DESCRIPTION[size],
      price: range.min,
      priceNote: range.min === range.max ? null : 'desde, según el gusto',
      action: 'Armar',
    };
  });

  // "Mitad y mitad": el tamaño se elige adentro, así que mostramos el mínimo
  // de todos los tamaños disponibles como precio de referencia.
  const cheapest = Math.min(...sizes.map((s) => sizeRange(pizzas, s)!.min));
  entries.push({
    mode: 'HALF',
    title: 'Mitad y mitad',
    description:
      'Combiná dos gustos en una misma pizza. Elegí el tamaño y después las mitades: cada 2 mitades forman una pizza.',
    price: cheapest,
    priceNote: 'desde, según tamaño y gustos',
    action: 'Combinar',
  });

  return (
    <>
      {entries.map((entry) => (
        <Grid item xs={6} sm={6} md={4} lg={3} key={entry.mode}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              border: '2px solid',
              borderColor: entry.mode === 'HALF' ? 'secondary.main' : 'primary.main',
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' },
            }}
          >
            <CardMedia
              component="img"
              image={PLACEHOLDER}
              alt={entry.title}
              onClick={() => setDetail(entry)}
              role="button"
              tabIndex={0}
              aria-label={`Ver detalle de ${entry.title}`}
              onKeyDown={(e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetail(entry); }
              }}
              sx={{ objectFit: 'cover', height: { xs: 110, sm: 180 }, cursor: 'pointer' }}
            />
            <CardContent sx={{ flexGrow: 1, p: { xs: 1.25, sm: 2 } }}>
              <Typography variant="h6" fontWeight={600} sx={{ fontSize: { xs: '0.9rem', sm: '1rem' } }} gutterBottom>
                {entry.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, display: { xs: 'none', sm: 'block' } }}>
                {entry.description}
              </Typography>
              <Typography color="primary.main" fontWeight={700} sx={{ fontSize: { xs: '0.95rem', sm: '1.25rem' } }}>
                {entry.price != null && formatCurrency(entry.price)}
                {entry.priceNote && (
                  <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                    {entry.priceNote}
                  </Typography>
                )}
              </Typography>
            </CardContent>
            <CardActions sx={{ p: { xs: 1.25, sm: 2 }, pt: 0 }}>
              <Button
                variant="contained"
                color={entry.mode === 'HALF' ? 'secondary' : 'primary'}
                fullWidth
                startIcon={<RestaurantMenuIcon />}
                onClick={() => setBuilding(entry)}
                sx={{ '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } } }}
              >
                {entry.action}
              </Button>
            </CardActions>
          </Card>
        </Grid>
      ))}

      {detail && (
        <ProductDetailModal
          open
          onClose={() => setDetail(null)}
          name={detail.title}
          description={detail.description}
          image={PLACEHOLDER}
          price={detail.price}
          priceNote={detail.priceNote}
          addLabel={detail.mode === 'HALF' ? 'Combinar gustos' : 'Armar mi pizza'}
          onAdd={() => setBuilding(detail)}
        />
      )}

      {building && (
        <PizzaCounterModal
          open
          onClose={() => setBuilding(null)}
          pizzas={pizzas}
          lockedMode={building.mode}
          title={building.mode === 'HALF' ? '🍕 Mitad y mitad' : `🍕 ${building.title}`}
          confirmLabel="Agregar a mi pedido"
          onConfirm={(lines) => {
            lines.forEach((l) =>
              addItem({
                type: 'product',
                productId: l.productId,
                name: l.name,
                image: null,
                unitPrice: l.unitPrice,
                quantity: l.quantity,
                notes: l.notes,
                pizza: l.pizza,
              })
            );
            setBuilding(null);
            openCart();
          }}
        />
      )}
    </>
  );
}
