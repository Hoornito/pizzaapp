'use client';

import Card from '@mui/material/Card';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Fab from '@mui/material/Fab';
import AddIcon from '@mui/icons-material/Add';
import { formatCurrency } from '@/lib/utils';

const PLACEHOLDER = '/images/placeholder-pizza.jpg';

export interface MenuItemCardProps {
  name: string;
  description?: string | null;
  image?: string | null;
  price: number;
  /** Aclaración bajo el precio: "desde", "c/u", "/ docena"… */
  priceNote?: string | null;
  /** Precio anterior tachado (promos). */
  oldPrice?: number | null;
  badge?: string | null;
  disabled?: boolean;
  disabledLabel?: string | null;
  /** Abre la ficha para elegir opciones y cantidad. */
  onOpen: () => void;
}

/**
 * Entrada del menú del cliente: foto, nombre, precio y los ingredientes
 * recortados a 2 líneas (terminan en "…" si no entran). Toda la card abre la
 * ficha; el botón + está para que se note que hay algo que tocar.
 */
export function MenuItemCard({
  name,
  description,
  image,
  price,
  priceNote,
  oldPrice,
  badge,
  disabled,
  disabledLabel,
  onOpen,
}: MenuItemCardProps) {
  // "desde"/"hasta" son preposiciones: van ANTES del precio ("hasta $30.000").
  // El resto ("c/u", "/ docena") va después.
  const isPrefixNote = priceNote === 'desde' || priceNote === 'hasta';

  return (
    <Card
      onClick={() => !disabled && onOpen()}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-label={`Ver ${name}`}
      onKeyDown={(e) => {
        if (!disabled && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onOpen(); }
      }}
      sx={{
        height: '100%', display: 'flex',
        // En celular: una entrada por fila, texto a la izquierda y foto a la
        // derecha. En pantallas grandes vuelve a la card vertical en grilla.
        flexDirection: { xs: 'row-reverse', sm: 'column' },
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        filter: disabled ? 'grayscale(1)' : 'none',
        transition: 'transform .2s, box-shadow .2s',
        '&:hover': disabled ? {} : { transform: 'translateY(-3px)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)' },
      }}
    >
      <Box sx={{ position: 'relative', flexShrink: 0, width: { xs: 132, sm: '100%' } }}>
        <Box
          component="img"
          src={image || PLACEHOLDER}
          alt={name}
          sx={{
            display: 'block', width: '100%',
            height: { xs: '100%', sm: 168 },
            minHeight: { xs: 118, sm: 'auto' },
            objectFit: 'cover',
          }}
        />
        {badge && (
          <Chip
            size="small"
            label={badge}
            color="secondary"
            sx={{ position: 'absolute', top: 8, left: 8, fontWeight: 700 }}
          />
        )}
        {!disabled && (
          <Fab
            size="small"
            color="primary"
            aria-label={`Agregar ${name}`}
            onClick={(e) => { e.stopPropagation(); onOpen(); }}
            sx={{
              position: 'absolute', right: 8,
              bottom: { xs: 8, sm: -18 },
              boxShadow: 3,
              // MUI le pone zIndex 1050 al Fab: sin esto se monta encima de la
              // barra de categorías al scrollear.
              zIndex: 1,
            }}
          >
            <AddIcon />
          </Fab>
        )}
      </Box>

      <Box
        sx={{
          p: { xs: 1.25, sm: 1.75 },
          pt: { xs: 1.25, sm: 2.25 },
          flexGrow: 1, minWidth: 0, display: 'flex', flexDirection: 'column',
        }}
      >
        <Typography
          variant="subtitle2"
          fontWeight={700}
          sx={{ lineHeight: 1.25, fontSize: { xs: '0.85rem', sm: '0.95rem' } }}
        >
          {name}
        </Typography>

        {/* Ingredientes: 2 líneas y corta con "…" */}
        {description && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{
              mt: 0.25, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
              overflow: 'hidden', lineHeight: 1.3,
            }}
          >
            {description}
          </Typography>
        )}

        <Box sx={{ mt: 'auto', pt: 1, display: 'flex', alignItems: 'baseline', gap: 0.75, flexWrap: 'wrap' }}>
          {disabled ? (
            <Typography variant="body2" fontWeight={700} color="text.disabled">
              {disabledLabel || 'No disponible'}
            </Typography>
          ) : (
            <>
              {isPrefixNote && (
                <Typography variant="caption" color="text.secondary">{priceNote}</Typography>
              )}
              <Typography variant="subtitle1" fontWeight={800} color="primary.main" sx={{ lineHeight: 1 }}>
                {formatCurrency(price)}
              </Typography>
              {oldPrice != null && oldPrice > price && (
                <Typography variant="caption" color="text.disabled" sx={{ textDecoration: 'line-through' }}>
                  {formatCurrency(oldPrice)}
                </Typography>
              )}
              {priceNote && !isPrefixNote && (
                <Typography variant="caption" color="text.secondary">{priceNote}</Typography>
              )}
            </>
          )}
        </Box>
      </Box>
    </Card>
  );
}
