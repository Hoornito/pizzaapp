'use client';

import { useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

export type Coccion = 'piedra' | 'molde';

interface CoccionDialogProps {
  open: boolean;
  title: string;
  onClose: () => void;
  onConfirm: (coccion: Coccion) => void;
  confirmLabel?: string;
}

const OPCIONES: { id: Coccion; label: string; hint: string }[] = [
  { id: 'piedra', label: '🔥 A la piedra', hint: 'Masa fina, la clásica' },
  { id: 'molde', label: '🍕 Al molde', hint: 'Masa alta y esponjosa' },
];

/**
 * Cómo se cocina la pizza. Se usa en las promos que llevan pizza grande, que es
 * la única que se hace al molde (ver promoHasLargePizza).
 */
export function CoccionDialog({ open, title, onClose, onConfirm, confirmLabel = 'Agregar a mi pedido' }: CoccionDialogProps) {
  const [coccion, setCoccion] = useState<Coccion>('piedra');

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          ¿Cómo querés la pizza?
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          {OPCIONES.map((o) => {
            const activa = coccion === o.id;
            return (
              <Button
                key={o.id}
                onClick={() => setCoccion(o.id)}
                variant={activa ? 'contained' : 'outlined'}
                sx={{
                  flex: 1, flexDirection: 'column', gap: 0.25, py: 1.5,
                  textTransform: 'none', lineHeight: 1.2,
                }}
              >
                <Box component="span" sx={{ fontWeight: 700 }}>{o.label}</Box>
                <Box component="span" sx={{ fontSize: '0.72rem', opacity: 0.8 }}>{o.hint}</Box>
              </Button>
            );
          })}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button variant="contained" onClick={() => onConfirm(coccion)}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
