'use client';

import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import { formatCurrency } from '@/lib/utils';

/**
 * Ficha de un producto: foto grande + descripción completa + precio.
 * La usan todas las cards del menú (pizzas, empanadas, bebidas, promos…) al
 * tocar la imagen. Si le pasás `onAdd`, muestra el botón de agregar al pedido.
 */
export interface ProductDetailModalProps {
  open: boolean;
  onClose: () => void;
  name: string;
  description?: string | null;
  image?: string | null;
  /** Precio a mostrar. Si es null, no se muestra (ej: pizzas, que dependen del tamaño). */
  price?: number | null;
  /** Texto bajo el precio (ej: "desde", "por porción"). */
  priceNote?: string | null;
  onAdd?: () => void;
  addLabel?: string;
  addDisabled?: boolean;
}

const PLACEHOLDER = '/images/placeholder-pizza.jpg';

export function ProductDetailModal({
  open,
  onClose,
  name,
  description,
  image,
  price,
  priceNote,
  onAdd,
  addLabel = 'Agregar a mi pedido',
  addDisabled,
}: ProductDetailModalProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth fullScreen={fullScreen}>
      {/* Foto grande, con la X flotando encima como en las apps de delivery */}
      <Box sx={{ position: 'relative', bgcolor: 'grey.100' }}>
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
          sx={{
            display: 'block', width: '100%', maxHeight: { xs: 260, sm: 320 },
            objectFit: 'contain', mx: 'auto',
          }}
        />
      </Box>

      <DialogContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
          <Typography variant="h6" fontWeight={700} sx={{ flex: 1 }}>{name}</Typography>
          {price != null && (
            <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
              <Typography variant="h6" fontWeight={700} color="primary.main">
                {formatCurrency(price)}
              </Typography>
              {priceNote && (
                <Typography variant="caption" color="text.secondary">{priceNote}</Typography>
              )}
            </Box>
          )}
        </Box>

        {description ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, whiteSpace: 'pre-line' }}>
            {description}
          </Typography>
        ) : (
          <Typography variant="body2" color="text.disabled" sx={{ mt: 1, fontStyle: 'italic' }}>
            Sin descripción.
          </Typography>
        )}

        {onAdd && (
          <Button
            fullWidth variant="contained" size="large" sx={{ mt: 3, borderRadius: 8, py: 1.25 }}
            onClick={() => { onAdd(); onClose(); }}
            disabled={addDisabled}
          >
            {addLabel}
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
