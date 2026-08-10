'use client';

import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { formatCurrency } from '@/lib/utils';

const PLACEHOLDER = '/images/placeholder-pizza.jpg';

/** Una opción elegible (p. ej. un tamaño de pizza con su precio). */
export interface OrderOption {
  id: string;
  label: string;
  /** Precio unitario del producto SI se elige esta opción. */
  price: number;
  caption?: string | null;
}

export interface ProductOrderModalProps {
  open: boolean;
  onClose: () => void;
  name: string;
  description?: string | null;
  image?: string | null;
  /** Precio cuando el producto no tiene opciones. Con opciones, manda la opción. */
  price?: number | null;
  /** Título del grupo de opciones (p. ej. "Tamaño"). */
  optionsLabel?: string;
  /** Si hay opciones, elegir una es obligatorio para poder agregar. */
  options?: OrderOption[];
  /** Tope de unidades (stock). Sin definir, no hay tope. */
  maxQuantity?: number;
  /** Se llama con la cantidad y la opción elegida (si había). */
  onAdd: (result: { quantity: number; option: OrderOption | null }) => void;
}

/**
 * Ficha de producto del menú: foto grande, ingredientes, opciones requeridas
 * (los tamaños de pizza con su precio), cantidad y "Agregar".
 *
 * Con opciones, el botón queda deshabilitado hasta elegir una: así no se puede
 * mandar al carrito una pizza sin tamaño.
 */
export function ProductOrderModal({
  open,
  onClose,
  name,
  description,
  image,
  price,
  optionsLabel = 'Elegí una opción',
  options,
  maxQuantity,
  onAdd,
}: ProductOrderModalProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));
  const [quantity, setQuantity] = useState(1);
  const [optionId, setOptionId] = useState<string | null>(null);

  const hasOptions = !!options && options.length > 0;
  // Con una sola opción no tiene sentido hacer elegir: viene marcada.
  useEffect(() => {
    if (open) {
      setQuantity(1);
      setOptionId(hasOptions && options!.length === 1 ? options![0].id : null);
    }
  }, [open, hasOptions, options]);

  const selected = hasOptions ? (options!.find((o) => o.id === optionId) ?? null) : null;
  const unitPrice = selected ? selected.price : (price ?? 0);
  const missingOption = hasOptions && !selected;
  const soldOut = maxQuantity != null && maxQuantity <= 0;
  const max = maxQuantity ?? Infinity;

  const addLabel = soldOut
    ? 'Sin stock'
    : missingOption
      ? 'Elegí una opción'
      : `Agregar · ${formatCurrency(unitPrice * quantity)}`;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={fullScreen} scroll="paper">
      {/* Foto grande con la X flotando encima */}
      <Box sx={{ position: 'relative', bgcolor: 'grey.100', flexShrink: 0 }}>
        <IconButton
          onClick={onClose}
          aria-label="Cerrar"
          sx={{
            position: 'absolute', top: 8, left: 8, zIndex: 1,
            bgcolor: 'background.paper', boxShadow: 2,
            '&:hover': { bgcolor: 'background.paper' },
          }}
        >
          <CloseIcon />
        </IconButton>
        <Box
          component="img"
          src={image || PLACEHOLDER}
          alt={name}
          sx={{ display: 'block', width: '100%', maxHeight: { xs: 240, sm: 300 }, objectFit: 'cover' }}
        />
      </Box>

      <DialogContent dividers sx={{ pb: 1 }}>
        <Typography variant="h6" fontWeight={700}>{name}</Typography>
        {description ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, whiteSpace: 'pre-line' }}>
            {description}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.disabled" sx={{ mt: 0.75, fontStyle: 'italic' }}>
            Sin descripción.
          </Typography>
        )}

        {!hasOptions && price != null && (
          <Typography variant="h6" fontWeight={700} color="primary.main" sx={{ mt: 1.5 }}>
            {formatCurrency(price)}
          </Typography>
        )}

        {hasOptions && (
          <Box sx={{ mt: 2.5 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle2" fontWeight={700}>{optionsLabel}</Typography>
              <Chip
                size="small"
                label={selected ? 'Listo' : 'Requerido'}
                color={selected ? 'success' : 'default'}
                variant={selected ? 'filled' : 'outlined'}
              />
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {options!.map((o) => {
                const isSel = optionId === o.id;
                return (
                  <Button
                    key={o.id}
                    onClick={() => setOptionId(o.id)}
                    fullWidth
                    disableElevation
                    sx={{
                      justifyContent: 'space-between', textTransform: 'none', textAlign: 'left',
                      px: 2, py: 1.25, borderRadius: 2,
                      border: '2px solid',
                      borderColor: isSel ? 'primary.main' : 'divider',
                      bgcolor: isSel ? 'action.selected' : 'transparent',
                      color: 'text.primary',
                    }}
                  >
                    <Box>
                      <Typography variant="body2" fontWeight={isSel ? 700 : 500}>{o.label}</Typography>
                      {o.caption && (
                        <Typography variant="caption" color="text.secondary">{o.caption}</Typography>
                      )}
                    </Box>
                    <Typography variant="body2" fontWeight={700} color="primary.main">
                      {formatCurrency(o.price)}
                    </Typography>
                  </Button>
                );
              })}
            </Box>
          </Box>
        )}

        {maxQuantity != null && maxQuantity > 0 && maxQuantity <= 5 && (
          <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 2 }}>
            Quedan {maxQuantity} unidades
          </Typography>
        )}
      </DialogContent>

      {/* Pie fijo: cantidad + agregar, como en las apps de delivery */}
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
        <Box
          sx={{
            display: 'flex', alignItems: 'center', gap: 0.5,
            border: '1px solid', borderColor: 'divider', borderRadius: 999, px: 0.5,
          }}
        >
          <IconButton size="small" onClick={() => setQuantity((q) => Math.max(1, q - 1))} disabled={quantity <= 1}>
            <RemoveIcon fontSize="small" />
          </IconButton>
          <Typography sx={{ minWidth: 24, textAlign: 'center', fontWeight: 700 }}>{quantity}</Typography>
          <IconButton
            size="small"
            onClick={() => setQuantity((q) => Math.min(max, q + 1))}
            disabled={quantity >= max}
          >
            <AddIcon fontSize="small" />
          </IconButton>
        </Box>
        <Button
          variant="contained"
          size="large"
          fullWidth
          disabled={missingOption || soldOut}
          onClick={() => {
            onAdd({ quantity, option: selected });
            onClose();
          }}
          sx={{ borderRadius: 999, py: 1.25, textTransform: 'none', fontWeight: 700 }}
        >
          {addLabel}
        </Button>
      </Box>
      <Divider />
    </Dialog>
  );
}
