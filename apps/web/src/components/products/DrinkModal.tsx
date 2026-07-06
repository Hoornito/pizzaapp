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
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import CloseIcon from '@mui/icons-material/Close';
import type { ProductWithCategory } from '@/types/product.types';
import { formatCurrency, toNumber } from '@/lib/utils';

export interface DrinkPick {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  drinks: ProductWithCategory[];
  onConfirm: (picks: DrinkPick[]) => void;
}

/** Selección de bebidas de una categoría de tamaño, con cantidad y precio por unidad. */
export function DrinkModal({ open, onClose, title, drinks, onConfirm }: Props) {
  const [qty, setQty] = useState<Record<string, number>>({});

  useEffect(() => {
    if (open) setQty({});
  }, [open]);

  const change = (id: string, delta: number) =>
    setQty((prev) => {
      const next = Math.max(0, (prev[id] ?? 0) + delta);
      const copy = { ...prev };
      if (next === 0) delete copy[id];
      else copy[id] = next;
      return copy;
    });

  const { totalUnits, totalPrice } = useMemo(() => {
    let units = 0;
    let price = 0;
    for (const d of drinks) {
      const n = qty[d.id] ?? 0;
      units += n;
      price += n * toNumber(d.price);
    }
    return { totalUnits: units, totalPrice: price };
  }, [qty, drinks]);

  const confirm = () => {
    const picks: DrinkPick[] = drinks
      .filter((d) => (qty[d.id] ?? 0) > 0)
      .map((d) => ({ productId: d.id, name: d.name, quantity: qty[d.id], unitPrice: toNumber(d.price) }));
    onConfirm(picks);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ pr: 6 }}>
        🥤 {title}
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', right: 12, top: 12 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        {drinks.length === 0 ? (
          <Typography color="text.secondary" sx={{ py: 2 }}>No hay bebidas en este tamaño.</Typography>
        ) : (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1, alignContent: 'start' }}>
            {drinks.map((d) => {
              const n = qty[d.id] ?? 0;
              return (
                <Paper
                  key={d.id}
                  variant="outlined"
                  sx={{
                    p: 0.75, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1,
                    borderColor: n > 0 ? 'primary.main' : 'divider', bgcolor: n > 0 ? 'action.hover' : 'background.paper',
                  }}
                >
                  <Avatar src={d.image || undefined} variant="rounded" sx={{ width: 36, height: 36, bgcolor: 'grey.100', fontSize: '1.1rem' }}>🥤</Avatar>
                  <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.2 }}>{d.name}</Typography>
                    <Typography variant="caption" color="text.secondary">{formatCurrency(toNumber(d.price))}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
                    <IconButton size="small" onClick={() => change(d.id, -1)} disabled={n === 0} sx={{ bgcolor: 'grey.100' }}><RemoveIcon fontSize="small" /></IconButton>
                    <Typography variant="body2" sx={{ minWidth: 20, textAlign: 'center', fontWeight: 700 }}>{n}</Typography>
                    <IconButton size="small" onClick={() => change(d.id, 1)} sx={{ bgcolor: 'grey.100' }}><AddIcon fontSize="small" /></IconButton>
                  </Box>
                </Paper>
              );
            })}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="caption" color="text.secondary" display="block">
            {totalUnits} {totalUnits === 1 ? 'bebida' : 'bebidas'}
          </Typography>
          <Typography variant="h6" fontWeight={700} color="primary.main">{formatCurrency(totalPrice)}</Typography>
        </Box>
        <Button variant="contained" size="large" disabled={totalUnits === 0} onClick={confirm}>
          Agregar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
