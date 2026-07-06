'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import CardMedia from '@mui/material/CardMedia';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import type { PromotionWithItems, EmpanadaDozen } from '@/types/product.types';
import { useCart } from '@/hooks/useCart';
import { useProducts, useCategories } from '@/hooks/useProducts';
import { formatCurrency } from '@/lib/utils';
import { useSnackbar } from '@/app/snackbar-context';
import { promoEmpanadaCount, formatPromoNotes } from '@/lib/promos';
import { EmpanadaPickModal } from '@/components/products/EmpanadaPickModal';
import { useMemo, useState } from 'react';

interface PromotionCardProps {
  promotion: PromotionWithItems;
}

export function PromotionCard({ promotion }: PromotionCardProps) {
  const { addItemAndOpen } = useCart();
  const { showSuccess } = useSnackbar();
  const { products } = useProducts({ available: true });
  const { categories } = useCategories();
  const [pickOpen, setPickOpen] = useState(false);

  const empanadaCount = promoEmpanadaCount(promotion.id);
  const empanadasCategoryId = useMemo(() => categories.find((c) => c.slug === 'empanadas')?.id, [categories]);
  const empanadas = useMemo(
    () => products.filter((p) => p.categoryId === empanadasCategoryId && p.available && !/doble cambalache/i.test(p.name)),
    [products, empanadasCategoryId]
  );

  const originalPrice = promotion.items.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0
  );
  const discount = originalPrice - Number(promotion.promotionalPrice);
  const discountPct = originalPrice > 0 ? Math.round((discount / originalPrice) * 100) : 0;

  const addToCart = (chosen?: EmpanadaDozen) => {
    addItemAndOpen({
      type: 'promotion',
      promotionId: promotion.id,
      name: promotion.name,
      image: promotion.image,
      unitPrice: Number(promotion.promotionalPrice),
      quantity: 1,
      notes: formatPromoNotes(promotion.id, chosen) || undefined,
    });
    showSuccess(`${promotion.name} agregado al carrito`);
  };

  const handleAdd = () => {
    if (empanadaCount > 0) setPickOpen(true);
    else addToCart();
  };

  return (
    <Card
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        border: '2px solid',
        borderColor: 'secondary.main',
        transition: 'transform 0.2s, box-shadow 0.2s',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 8px 24px rgba(245,124,0,0.2)',
        },
      }}
    >
      {discountPct > 0 && (
        <Box
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            bgcolor: 'error.main',
            color: 'white',
            borderRadius: '50%',
            width: 48,
            height: 48,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: '0.8rem',
            zIndex: 1,
          }}
        >
          -{discountPct}%
        </Box>
      )}

      <Box sx={{ position: 'relative' }}>
        <CardMedia
          component="img"
          height="180"
          image={promotion.image || '/images/placeholder-promo.jpg'}
          alt={promotion.name}
          sx={{ objectFit: 'cover' }}
        />
      </Box>

      <CardContent sx={{ flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          <LocalOfferIcon color="secondary" fontSize="small" />
          <Chip label="Promoción" size="small" color="secondary" />
        </Box>

        <Typography variant="h6" fontWeight={700} gutterBottom>
          {promotion.name}
        </Typography>

        {promotion.description && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {promotion.description}
          </Typography>
        )}

        <Box sx={{ mb: 1 }}>
          {promotion.items.map((item) => (
            <Typography key={item.id} variant="caption" display="block" color="text.secondary">
              • {item.quantity}x {item.product.name}
            </Typography>
          ))}
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" color="secondary.main" fontWeight={700}>
            {formatCurrency(Number(promotion.promotionalPrice))}
          </Typography>
          {originalPrice > Number(promotion.promotionalPrice) && (
            <Typography
              variant="body2"
              sx={{ textDecoration: 'line-through', color: 'text.disabled' }}
            >
              {formatCurrency(originalPrice)}
            </Typography>
          )}
        </Box>
      </CardContent>

      <CardActions sx={{ p: 2, pt: 0 }}>
        <Button
          variant="contained"
          color="secondary"
          fullWidth
          startIcon={<AddShoppingCartIcon />}
          onClick={handleAdd}
          disabled={!promotion.available}
        >
          {empanadaCount > 0 ? `Elegir ${empanadaCount} empanadas` : 'Agregar promoción'}
        </Button>
      </CardActions>

      {empanadaCount > 0 && (
        <EmpanadaPickModal
          open={pickOpen}
          onClose={() => setPickOpen(false)}
          title={`${promotion.name} · elegí ${empanadaCount} empanadas`}
          count={empanadaCount}
          empanadas={empanadas}
          onConfirm={(chosen) => {
            addToCart(chosen);
            setPickOpen(false);
          }}
        />
      )}
    </Card>
  );
}
