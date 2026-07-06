'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Paper from '@mui/material/Paper';
import Avatar from '@mui/material/Avatar';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DeleteIcon from '@mui/icons-material/Delete';
import type { CartItemLocal } from '@/types/product.types';
import { useCart } from '@/hooks/useCart';
import { formatCurrency } from '@/lib/utils';

interface CartItemProps {
  item: CartItemLocal;
}

export function CartItem({ item }: CartItemProps) {
  const { updateQuantity, removeItem } = useCart();
  const isDozen = !!item.dozens?.length;
  const isPizza = !!item.pizza;

  return (
    <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
      <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
        <Avatar
          src={item.image || undefined}
          variant="rounded"
          sx={{ width: 56, height: 56, bgcolor: 'grey.200', fontSize: '1.5rem' }}
        >
          {!item.image && (isDozen ? '🥟' : isPizza ? '🍕' : item.type === 'promotion' ? '🎁' : '🛒')}
        </Avatar>

        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {item.name}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {isDozen
              ? `${formatCurrency(item.unitPrice)} / docena`
              : isPizza
                ? formatCurrency(item.unitPrice)
                : `${formatCurrency(item.unitPrice)} c/u`}
          </Typography>

          {/* Composición de la pizza (gusto / mitad y mitad) */}
          {isPizza && item.pizza!.flavors.length > 1 && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
              <strong>Mitad y mitad:</strong> {item.pizza!.flavors.map((f) => f.name).join(' / ')}
            </Typography>
          )}

          {/* Composición de cada docena (sólo flujo empanadas) */}
          {isDozen && (
            <Box sx={{ mt: 0.5 }}>
              {item.dozens!.map((dozen, i) => (
                <Typography key={i} variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  <strong>Docena {i + 1}:</strong>{' '}
                  {dozen.flavors
                    .map((f) => `${f.quantity} ${f.name.replace(/^Empanada de\s+/i, '')}`)
                    .join(', ')}
                </Typography>
              ))}
            </Box>
          )}

          <Box sx={{ display: 'flex', alignItems: 'center', mt: 1, gap: 0.5 }}>
            {isDozen ? (
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {item.quantity} {item.quantity === 1 ? 'docena' : 'docenas'}
              </Typography>
            ) : isPizza ? (
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                1 pizza
              </Typography>
            ) : (
              <>
                <IconButton
                  size="small"
                  onClick={() => updateQuantity(item.id, item.quantity - 1)}
                  sx={{ bgcolor: 'grey.100', '&:hover': { bgcolor: 'grey.200' } }}
                >
                  <RemoveIcon fontSize="small" />
                </IconButton>

                <Typography variant="body2" sx={{ minWidth: 28, textAlign: 'center', fontWeight: 600 }}>
                  {item.quantity}
                </Typography>

                <IconButton
                  size="small"
                  onClick={() => updateQuantity(item.id, item.quantity + 1)}
                  sx={{ bgcolor: 'grey.100', '&:hover': { bgcolor: 'grey.200' } }}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </>
            )}

            <Box sx={{ flexGrow: 1 }} />

            <Typography variant="body2" fontWeight={700} color="primary.main">
              {formatCurrency(item.unitPrice * item.quantity)}
            </Typography>

            <IconButton size="small" color="error" onClick={() => removeItem(item.id)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </Box>
    </Paper>
  );
}
