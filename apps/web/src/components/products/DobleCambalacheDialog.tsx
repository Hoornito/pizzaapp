'use client';

import { useState, useEffect } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { formatCurrency } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  price: number;
  /** Devuelve la descripción de gustos ingresada. */
  onConfirm: (notes: string) => void;
}

/** Pide los gustos que lleva la Empanada Doble Cambalache antes de agregarla. */
export function DobleCambalacheDialog({ open, onClose, price, onConfirm }: Props) {
  const [text, setText] = useState('');
  useEffect(() => { if (open) setText(''); }, [open]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>🥟 Empanada Doble Cambalache</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Indicá qué gustos querés en la doble.
        </Typography>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={2}
          label="Gustos / descripción"
          placeholder="Ej: mitad carne, mitad jamón y queso"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, justifyContent: 'space-between' }}>
        <Typography fontWeight={700} color="primary.main">{formatCurrency(price)}</Typography>
        <Button variant="contained" disabled={!text.trim()} onClick={() => onConfirm(text.trim())}>
          Agregar
        </Button>
      </DialogActions>
    </Dialog>
  );
}
