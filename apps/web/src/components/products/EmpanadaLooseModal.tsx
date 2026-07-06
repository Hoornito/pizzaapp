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

export interface LooseSelection {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  empanadas: ProductWithCategory[];
  onConfirm: (selection: LooseSelection[]) => void;
}

/** Empanadas sueltas: cantidad libre por gusto, se suman al precio individual. */
export function EmpanadaLooseModal({ open, onClose, empanadas, onConfirm }: Props) {
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
    for (const e of empanadas) {
      const n = qty[e.id] ?? 0;
      units += n;
      price += n * toNumber(e.price);
    }
    return { totalUnits: units, totalPrice: price };
  }, [qty, empanadas]);

  const confirm = () => {
    const selection: LooseSelection[] = empanadas
      .filter((e) => (qty[e.id] ?? 0) > 0)
      .map((e) => ({ productId: e.id, name: e.name, quantity: qty[e.id], unitPrice: toNumber(e.price) }));
    onConfirm(selection);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ pr: 6 }}>
        🥟 Empanadas sueltas
        <IconButton onClick={onClose} size="small" sx={{ position: 'absolute', right: 12, top: 12 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Elegí la cantidad de cada gusto. Se cobran por unidad.
        </Typography>
        <Box
          sx={{
            maxHeight: { xs: '45vh', sm: 360 },
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
            gap: 1,
            alignContent: 'start',
          }}
        >
          {empanadas.map((emp) => {
            const n = qty[emp.id] ?? 0;
            return (
              <Paper
                key={emp.id}
                variant="outlined"
                sx={{
                  p: 0.75, borderRadius: 2, display: 'flex', alignItems: 'center', gap: 1,
                  borderColor: n > 0 ? 'primary.main' : 'divider', bgcolor: n > 0 ? 'action.hover' : 'background.paper',
                }}
              >
                <Avatar src={emp.image || undefined} variant="rounded" sx={{ width: 36, height: 36, bgcolor: 'grey.100', fontSize: '1.1rem' }}>🥟</Avatar>
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.2 }}>{emp.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{formatCurrency(toNumber(emp.price))}</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25, flexShrink: 0 }}>
                  <IconButton size="small" onClick={() => change(emp.id, -1)} disabled={n === 0} sx={{ bgcolor: 'grey.100' }}><RemoveIcon fontSize="small" /></IconButton>
                  <Typography variant="body2" sx={{ minWidth: 20, textAlign: 'center', fontWeight: 700 }}>{n}</Typography>
                  <IconButton size="small" onClick={() => change(emp.id, 1)} sx={{ bgcolor: 'grey.100' }}><AddIcon fontSize="small" /></IconButton>
                </Box>
              </Paper>
            );
          })}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="caption" color="text.secondary" display="block">
            {totalUnits} {totalUnits === 1 ? 'empanada' : 'empanadas'}
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
