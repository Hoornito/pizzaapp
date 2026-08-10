'use client';

import { useState, type KeyboardEvent } from 'react';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Box from '@mui/material/Box';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import type { ProductWithCategory } from '@/types/product.types';
import { useCart } from '@/hooks/useCart';
import { formatCurrency } from '@/lib/utils';
import { useSnackbar } from '@/app/snackbar-context';
import { controlsStock } from '@/lib/constants';
import { DobleCambalacheDialog } from './DobleCambalacheDialog';
import { ProductDetailModal } from './ProductDetailModal';

interface ProductCardProps {
  product: ProductWithCategory;
}

export function ProductCard({ product }: ProductCardProps) {
  const { addItemAndOpen, items } = useCart();
  const { showError } = useSnackbar();
  // La Doble Cambalache pide los gustos antes de agregarse.
  const isDoble = /doble cambalache/i.test(product.name);
  const [dobleOpen, setDobleOpen] = useState(false);
  // Ficha del producto: se abre al tocar la foto (desktop y mobile).
  const [detailOpen, setDetailOpen] = useState(false);

  // Postres y bebidas controlan stock. No mostramos la cantidad al cliente, pero
  // no dejamos agregar más de lo disponible (el servidor igual valida al cobrar).
  const tracksStock = controlsStock(product.category?.slug);
  const stock = product.stock ?? 0;
  const inCart = tracksStock ? items.filter((i) => i.productId === product.id).reduce((s, i) => s + i.quantity, 0) : 0;
  const outOfStock = tracksStock && stock <= 0;
  const noMoreStock = tracksStock && inCart >= stock;
  const canAdd = product.available && !outOfStock && !noMoreStock;

  const addToCart = (notes?: string) => {
    if (tracksStock && inCart + 1 > stock) {
      showError(`No quedan más de ${product.name} por ahora.`);
      return;
    }
    addItemAndOpen({
      type: 'product',
      productId: product.id,
      name: product.name,
      image: product.image,
      unitPrice: Number(product.price),
      quantity: 1,
      notes,
    });
  };

  const handleAddToCart = () => {
    if (isDoble) setDobleOpen(true);
    else addToCart();
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.2s, box-shadow 0.2s',
        opacity: outOfStock ? 0.55 : 1,
        filter: outOfStock ? 'grayscale(1)' : 'none',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
        },
      }}
    >
      <CardMedia
        component="img"
        image={product.image || '/images/placeholder-pizza.jpg'}
        alt={product.name}
        onClick={() => setDetailOpen(true)}
        role="button"
        tabIndex={0}
        aria-label={`Ver detalle de ${product.name}`}
        onKeyDown={(e: KeyboardEvent) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetailOpen(true); }
        }}
        sx={{ objectFit: 'cover', height: { xs: 110, sm: 180 }, cursor: 'pointer' }}
      />
      <CardContent sx={{ flexGrow: 1, p: { xs: 1.25, sm: 2 } }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, gap: 0.5 }}>
          <Typography variant="h6" fontWeight={600} sx={{ fontSize: { xs: '0.9rem', sm: '1rem' }, lineHeight: 1.2 }}>
            {product.name}
          </Typography>
          <Chip
            label={product.category.name}
            size="small"
            variant="outlined"
            sx={{ ml: 0.5, flexShrink: 0, display: { xs: 'none', sm: 'flex' } }}
          />
        </Box>
        {product.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineClamp: 2, WebkitLineClamp: 2, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical' }}>
            {product.description}
          </Typography>
        )}
        <Typography color="primary.main" fontWeight={700} sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
          {formatCurrency(Number(product.price))}
        </Typography>
      </CardContent>
      <CardActions sx={{ p: { xs: 1.25, sm: 2 }, pt: 0 }}>
        <Button
          variant="contained"
          fullWidth
          startIcon={<AddShoppingCartIcon />}
          onClick={handleAddToCart}
          disabled={!canAdd}
          sx={{ '& .MuiButton-startIcon': { display: { xs: 'none', sm: 'inherit' } } }}
        >
          {outOfStock ? 'Sin stock' : noMoreStock ? 'Sin más por ahora' : !product.available ? 'No disponible' : 'Agregar'}
        </Button>
      </CardActions>
      <ProductDetailModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        name={product.name}
        description={product.description}
        image={product.image}
        price={Number(product.price)}
        onAdd={handleAddToCart}
        addDisabled={!canAdd}
        addLabel={outOfStock ? 'Sin stock' : noMoreStock ? 'Sin más por ahora' : 'Agregar a mi pedido'}
      />
      {isDoble && (
        <DobleCambalacheDialog
          open={dobleOpen}
          onClose={() => setDobleOpen(false)}
          price={Number(product.price)}
          onConfirm={(notes) => { addToCart(notes); setDobleOpen(false); }}
        />
      )}
    </Card>
  );
}
