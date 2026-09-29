'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Alert from '@mui/material/Alert';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import { useSnackbar } from '@/app/snackbar-context';
import { formatDate } from '@/lib/utils';
import { CASH_SHIFTS, CASH_SHIFT_LABELS } from '@/lib/constants';

export interface CashRegisterStatus {
  id: string;
  shift: string | null;
  isTest: boolean;
  openedAt: string;
}

/**
 * Abrir y cerrar la caja desde Mostrador, para que el mostrador no necesite
 * entrar a Finanzas. El cierre es a ciegas: se carga el efectivo contado pero
 * no se muestra el esperado ni la diferencia (eso lo ve el admin en Finanzas).
 */
export function CashRegisterBar({
  register,
  onChange,
}: {
  /** `undefined` mientras carga; `null` si la caja está cerrada. */
  register: CashRegisterStatus | null | undefined;
  onChange: () => void;
}) {
  const { showSuccess, showError } = useSnackbar();
  const [saving, setSaving] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [openForm, setOpenForm] = useState({ shift: '', openingBalance: '', notes: '' });
  const [closeDialog, setCloseDialog] = useState(false);
  const [closeForm, setCloseForm] = useState({ countedCash: '', notes: '' });

  const post = async (url: string, body: unknown, errorMsg: string) => {
    setSaving(true);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        showError(json?.error || errorMsg);
        return false;
      }
      return true;
    } catch {
      showError('Error de conexión');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleOpen = async () => {
    const isTest = openForm.shift === 'TEST';
    if (
      isTest &&
      !window.confirm(
        'USTED ESTÁ POR INICIAR UNA SIMULACIÓN DE CAJA !!\n' +
          'NO ESTÁ POR ABRIR CAJA NORMALMENTE !!\n' +
          'NADA QUEDARÁ REGISTRADO !!\n\n' +
          '¿Desea continuar?'
      )
    ) {
      return;
    }
    const ok = await post(
      '/api/admin/finance/cash-register',
      {
        shift: isTest ? null : openForm.shift,
        isTest,
        openingBalance: Number(openForm.openingBalance || 0),
        notes: openForm.notes || null,
      },
      'Error al abrir la caja'
    );
    if (!ok) return;
    showSuccess(isTest ? 'Simulación iniciada' : 'Caja abierta');
    setOpenDialog(false);
    setOpenForm({ shift: '', openingBalance: '', notes: '' });
    onChange();
  };

  const handleCloseTest = async () => {
    if (
      !window.confirm(
        'Vas a cerrar la SIMULACIÓN. Se borrarán todos los pedidos y movimientos de prueba cargados. ¿Continuar?'
      )
    ) {
      return;
    }
    const ok = await post('/api/admin/finance/cash-register/close', { countedCash: 0 }, 'Error al cerrar la simulación');
    if (!ok) return;
    showSuccess('Simulación finalizada. Se borraron los datos de prueba.');
    onChange();
  };

  const handleClose = async () => {
    const ok = await post(
      '/api/admin/finance/cash-register/close',
      { countedCash: Number(closeForm.countedCash || 0), notes: closeForm.notes || null },
      'Error al cerrar la caja'
    );
    if (!ok) return;
    showSuccess('Caja cerrada');
    setCloseDialog(false);
    setCloseForm({ countedCash: '', notes: '' });
    onChange();
  };

  return (
    <>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
            <Typography fontWeight={600}>Caja</Typography>
            {register !== undefined && (
              <Chip
                label={register ? (register.isTest ? 'SIMULACIÓN' : 'ABIERTA') : 'CERRADA'}
                color={register ? (register.isTest ? 'warning' : 'success') : 'default'}
                size="small"
              />
            )}
            {register?.shift && (
              <Chip label={CASH_SHIFT_LABELS[register.shift] || register.shift} color="info" size="small" variant="outlined" />
            )}
            {register && (
              <Typography variant="body2" color="text.secondary">
                Abierta el {formatDate(register.openedAt)}
              </Typography>
            )}
          </Box>
          {register === undefined ? null : register ? (
            register.isTest ? (
              <Button variant="outlined" color="warning" onClick={handleCloseTest} disabled={saving}>
                Cerrar simulación
              </Button>
            ) : (
              <Button variant="outlined" color="error" onClick={() => setCloseDialog(true)}>
                Cerrar caja
              </Button>
            )
          ) : (
            <Button variant="contained" onClick={() => setOpenDialog(true)}>
              Abrir caja
            </Button>
          )}
        </Box>
      </Paper>

      <Dialog open={openDialog} onClose={() => setOpenDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Abrir caja</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Turno *</InputLabel>
              <Select
                label="Turno *"
                value={openForm.shift}
                onChange={(e) => setOpenForm((p) => ({ ...p, shift: e.target.value }))}
              >
                {CASH_SHIFTS.map((s) => (
                  <MenuItem key={s} value={s}>{CASH_SHIFT_LABELS[s]}</MenuItem>
                ))}
                <MenuItem value="TEST">=== TEST === (simulación para entrenar)</MenuItem>
              </Select>
            </FormControl>
            {openForm.shift !== 'TEST' && (
              <TextField
                label="Saldo inicial en efectivo *"
                type="number"
                inputProps={{ min: 0, step: 0.01 }}
                value={openForm.openingBalance}
                onChange={(e) => setOpenForm((p) => ({ ...p, openingBalance: e.target.value }))}
                fullWidth
                helperText="Efectivo con el que arranca la caja"
              />
            )}
            {openForm.shift === 'TEST' && (
              <Alert severity="warning">
                Vas a abrir una <strong>caja de simulación</strong> para practicar/enseñar. Nada de lo
                que cargues acá queda registrado ni impacta en los reportes.
              </Alert>
            )}
            <TextField
              label="Notas"
              value={openForm.notes}
              onChange={(e) => setOpenForm((p) => ({ ...p, notes: e.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleOpen}
            disabled={saving || !openForm.shift || (openForm.shift !== 'TEST' && openForm.openingBalance === '')}
          >
            {openForm.shift === 'TEST' ? 'Iniciar simulación' : 'Abrir'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={closeDialog} onClose={() => setCloseDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Cerrar caja</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Efectivo contado *"
              type="number"
              inputProps={{ min: 0, step: 0.01 }}
              value={closeForm.countedCash}
              onChange={(e) => setCloseForm((p) => ({ ...p, countedCash: e.target.value }))}
              fullWidth
              helperText="Total de efectivo físico contado en la caja"
            />
            <TextField
              label="Notas del cierre"
              value={closeForm.notes}
              onChange={(e) => setCloseForm((p) => ({ ...p, notes: e.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCloseDialog(false)}>Cancelar</Button>
          <Button variant="contained" color="error" onClick={handleClose} disabled={saving || closeForm.countedCash === ''}>
            Cerrar caja
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
