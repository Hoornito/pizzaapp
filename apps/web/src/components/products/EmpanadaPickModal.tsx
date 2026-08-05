'use client';

import { useEffect, useMemo, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Avatar from '@mui/material/Avatar';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import CloseIcon from '@mui/icons-material/Close';
import type { ProductWithCategory, EmpanadaDozen } from '@/types/product.types';
import { toNumber } from '@/lib/utils';
import { ProductDetailModal } from './ProductDetailModal';

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Cantidad exacta de empanadas a elegir. */
  count: number;
  empanadas: ProductWithCategory[];
  onConfirm: (chosen: EmpanadaDozen) => void;
}

/**
 * Selección de exactamente `count` empanadas (para promos con empanadas "a
 * elección"). Reutiliza el patrón del armado de docenas pero con un objetivo
 * arbitrario y una sola composición.
 */
export function EmpanadaPickModal({ open, onClose, title, count, empanadas, onConfirm }: Props) {
  const [qty, setQty] = useState<Record<string, number>>({});
  // Ficha del gusto (se abre tocando la foto), sin perder lo ya elegido.
  const [detail, setDetail] = useState<ProductWithCategory | null>(null);

  useEffect(() => {
    if (open) { setQty({}); setDetail(null); }
  }, [open]);

  const total = useMemo(() => Object.values(qty).reduce((a, n) => a + n, 0), [qty]);
  const complete = total === count;

  const change = (id: string, delta: number) =>
    setQty((prev) => {
      const current = prev[id] ?? 0;
      const next = current + delta;
      if (next < 0) return prev;
      if (delta > 0 && total >= count) return prev; // no superar el objetivo
      const copy = { ...prev };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });

  const confirm = () => {
    const flavors = empanadas
      .filter((e) => (qty[e.id] ?? 0) > 0)
      .map((e) => ({ productId: e.id, name: e.name, quantity: qty[e.id] }));
    onConfirm({ flavors });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ pr: 6 }}>
        🥟 {title}
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', right: 12, top: 12 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="subtitle2" fontWeight={700}>Elegí {count} empanadas</Typography>
          <Chip size="small" color={complete ? 'success' : 'default'} label={`${total} / ${count}`} sx={{ fontWeight: 700 }} />
        </Box>
        <LinearProgress
          variant="determinate"
          value={Math.min((total / count) * 100, 100)}
          color={complete ? 'success' : 'primary'}
          sx={{ height: 6, borderRadius: 3, mb: 1.5 }}
        />
        <Divider sx={{ mb: 1.5 }} />

        {empanadas.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2 }}>No hay empanadas disponibles.</Typography>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 1, alignContent: 'start', overflowX: 'hidden' }}>
            {empanadas.map((emp) => {
              const n = qty[emp.id] ?? 0;
              const selected = n > 0;
              return (
                <Paper
                  key={emp.id}
                  variant="outlined"
                  sx={{
                    p: 0.75, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1,
                    borderColor: selected ? 'primary.main' : 'divider', bgcolor: selected ? 'action.hover' : 'background.paper',
                  }}
                >
                  {/* Foto: abre la ficha del gusto con la descripción completa. */}
                  <Avatar
                    src={emp.image || undefined}
                    variant="rounded"
                    onClick={() => setDetail(emp)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Ver detalle de ${emp.name}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setDetail(emp); }
                    }}
                    sx={{ width: 52, height: 52, bgcolor: 'grey.100', fontSize: '1.4rem', cursor: 'pointer', flexShrink: 0 }}
                  >
                    🥟
                  </Avatar>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.2 }}>
                      {emp.name.replace(/^Empanada de\s+/i, '').replace(/^Empanada\s+/i, '')}
                    </Typography>
                    {emp.description && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                          overflow: 'hidden', lineHeight: 1.25,
                        }}
                      >
                        {emp.description}
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
                    <IconButton size="small" onClick={() => change(emp.id, -1)} disabled={n === 0} sx={{ bgcolor: 'grey.100' }}><RemoveIcon fontSize="small" /></IconButton>
                    <Typography variant="body2" sx={{ minWidth: 20, textAlign: 'center', fontWeight: 700 }}>{n}</Typography>
                    <IconButton size="small" onClick={() => change(emp.id, 1)} disabled={total >= count} sx={{ bgcolor: 'grey.100' }}><AddIcon fontSize="small" /></IconButton>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary">
          {complete ? '¡Listo!' : `Faltan ${count - total}`}
        </Typography>
        <Button variant="contained" size="large" disabled={!complete} onClick={confirm}>
          Confirmar
        </Button>
      </DialogActions>

      {/* Ficha del gusto: informativa, la cantidad se maneja con los contadores. */}
      <ProductDetailModal
        open={!!detail}
        onClose={() => setDetail(null)}
        name={detail?.name ?? ''}
        description={detail?.description}
        image={detail?.image}
        price={detail ? toNumber(detail.price) : null}
        priceNote="precio suelta · en la promo va incluida"
        addLabel={total >= count ? 'Ya elegiste todas' : 'Agregar a la promo'}
        addDisabled={total >= count}
        onAdd={() => detail && change(detail.id, 1)}
      />
    </Dialog>
  );
}
