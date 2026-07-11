'use client';

import { useEffect, useState } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import { formatCurrency } from '@/lib/utils';

export type PaymentKind = 'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'MIXTO';

interface Props {
  open: boolean;
  total: number;
  /** Medio actual del pedido (para precargar). */
  initialMethod?: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (data: { method: PaymentKind; cashAmount?: number; transferAmount?: number }) => void;
}

export function PaymentDialog({ open, total, initialMethod, busy, onClose, onConfirm }: Props) {
  const [method, setMethod] = useState<PaymentKind>('EFECTIVO');
  const [cash, setCash] = useState('');
  const [transfer, setTransfer] = useState('');

  useEffect(() => {
    if (!open) return;
    const start: PaymentKind =
      initialMethod === 'TRANSFERENCIA' || initialMethod === 'TARJETA' || initialMethod === 'MIXTO'
        ? initialMethod
        : 'EFECTIVO';
    setMethod(start);
    setCash(String(total));
    setTransfer('0');
  }, [open, initialMethod, total]);

  const setSplit = (field: 'cash' | 'transfer', value: string) => {
    const raw = parseFloat(value);
    const amount = Math.min(Math.max(Number.isNaN(raw) ? 0 : raw, 0), total);
    const other = Math.round((total - amount) * 100) / 100;
    if (field === 'cash') { setCash(value === '' ? '' : String(amount)); setTransfer(String(other)); }
    else { setTransfer(value === '' ? '' : String(amount)); setCash(String(other)); }
  };

  const cashN = parseFloat(cash) || 0;
  const transferN = parseFloat(transfer) || 0;
  const mixtoOk = method !== 'MIXTO' || Math.abs(cashN + transferN - total) < 0.01;

  const submit = () => {
    if (method === 'MIXTO') onConfirm({ method, cashAmount: cashN, transferAmount: transferN });
    else onConfirm({ method });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Registrar cobro</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          Total: <strong>{formatCurrency(total)}</strong>. ¿Cómo pagó?
        </Typography>
        <RadioGroup value={method} onChange={(e) => setMethod(e.target.value as PaymentKind)}>
          <FormControlLabel value="EFECTIVO" control={<Radio />} label="💵 Efectivo" />
          <FormControlLabel value="TRANSFERENCIA" control={<Radio />} label="🏦 Transferencia" />
          <FormControlLabel value="TARJETA" control={<Radio />} label="💳 QR o Tarjeta" />
          <FormControlLabel value="MIXTO" control={<Radio />} label="🔀 Mixto (efectivo + transferencia)" />
        </RadioGroup>

        {method === 'MIXTO' && (
          <Box sx={{ mt: 1 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
              <TextField label="Efectivo" type="number" size="small" value={cash} onChange={(e) => setSplit('cash', e.target.value)} />
              <TextField label="Transferencia" type="number" size="small" value={transfer} onChange={(e) => setSplit('transfer', e.target.value)} />
            </Box>
            {!mixtoOk && (
              <Alert severity="error" sx={{ mt: 1 }}>
                La suma ({formatCurrency(cashN + transferN)}) debe ser igual al total.
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancelar</Button>
        <Button variant="contained" onClick={submit} disabled={busy || !mixtoOk}>
          {busy ? 'Guardando…' : 'Confirmar cobro'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
