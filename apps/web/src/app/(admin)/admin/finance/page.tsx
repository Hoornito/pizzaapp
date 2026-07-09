'use client';

import { useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { StatCard } from '@/components/admin/StatCard';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useSnackbar } from '@/app/snackbar-context';
import { formatCurrency, formatDate } from '@/lib/utils';
import {
  FINANCE_INCOME_CATEGORIES,
  FINANCE_EXPENSE_CATEGORIES,
  FINANCE_PAYMENT_METHODS,
  FINANCE_PAYMENT_METHOD_LABELS,
  CASH_SHIFTS,
  CASH_SHIFT_LABELS,
  FINANCE_CATEGORY_SUELDOS,
  FINANCE_CATEGORY_ADELANTOS,
} from '@/lib/constants';

type TxnType = 'INCOME' | 'EXPENSE';

interface TxnForm {
  amount: string;
  category: string;
  description: string;
  paymentMethod: string;
  employeeId: string;
}

const emptyForm: TxnForm = { amount: '', category: '', description: '', paymentMethod: 'EFECTIVO', employeeId: '' };

const needsEmployee = (category: string) =>
  category === FINANCE_CATEGORY_SUELDOS || category === FINANCE_CATEGORY_ADELANTOS;

export default function FinancePage() {
  const { showSuccess, showError } = useSnackbar();
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Dialog de movimiento manual (ingreso/egreso)
  const [txnDialog, setTxnDialog] = useState<TxnType | null>(null);
  const [txnForm, setTxnForm] = useState<TxnForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);

  // Dialogs de caja
  const [openDialog, setOpenDialog] = useState(false);
  const [openForm, setOpenForm] = useState({ shift: '', openingBalance: '', notes: '' });
  const [closeDialog, setCloseDialog] = useState(false);
  const [closeForm, setCloseForm] = useState({ countedCash: '', notes: '' });

  const loadSummary = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/finance/summary')
      .then((r) => r.json())
      .then((d) => setSummary(d.data))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadSummary(); }, [loadSummary]);

  useEffect(() => {
    fetch('/api/admin/employees?active=true')
      .then((r) => r.json())
      .then((d) => setEmployees(d.data || []))
      .catch(() => {});
  }, []);

  const register = summary?.register || null;
  const totals = summary?.totals || null;
  const ledger: any[] = summary?.ledger || [];
  const history: any[] = summary?.history || [];

  // ─── Movimientos manuales ──────────────────────────────────────────────
  const openTxnDialog = (type: TxnType) => {
    setTxnForm(emptyForm);
    setTxnDialog(type);
  };

  const categories = txnDialog === 'INCOME' ? FINANCE_INCOME_CATEGORIES : FINANCE_EXPENSE_CATEGORIES;

  const handleSaveTxn = async () => {
    if (!txnDialog) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/finance/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: txnDialog,
          amount: Number(txnForm.amount),
          category: txnForm.category,
          description: txnForm.description || null,
          paymentMethod: txnForm.paymentMethod,
          employeeId: needsEmployee(txnForm.category) ? txnForm.employeeId || null : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showError(json.error || 'Error al guardar');
        return;
      }
      showSuccess(txnDialog === 'INCOME' ? 'Ingreso registrado' : 'Egreso registrado');
      setTxnDialog(null);
      loadSummary();
    } catch {
      showError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTxn = async (id: string) => {
    if (!confirm('¿Eliminar este movimiento? Esta acción no se puede deshacer.')) return;
    try {
      const res = await fetch(`/api/admin/finance/transactions/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) {
        showError(json.error || 'Error al eliminar');
        return;
      }
      showSuccess('Movimiento eliminado');
      loadSummary();
    } catch {
      showError('Error de conexión');
    }
  };

  // ─── Caja ──────────────────────────────────────────────────────────────
  const handleOpenRegister = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/finance/cash-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shift: openForm.shift,
          openingBalance: Number(openForm.openingBalance || 0),
          notes: openForm.notes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showError(json.error || 'Error al abrir la caja');
        return;
      }
      showSuccess('Caja abierta');
      setOpenDialog(false);
      setOpenForm({ shift: '', openingBalance: '', notes: '' });
      loadSummary();
    } catch {
      showError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleCloseRegister = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/finance/cash-register/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          countedCash: Number(closeForm.countedCash || 0),
          notes: closeForm.notes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showError(json.error || 'Error al cerrar la caja');
        return;
      }
      const diff = Number(json.data.difference);
      showSuccess(
        `Caja cerrada. Diferencia: ${formatCurrency(diff)} (${diff === 0 ? 'cuadra' : diff > 0 ? 'sobrante' : 'faltante'})`
      );
      setCloseDialog(false);
      setCloseForm({ countedCash: '', notes: '' });
      loadSummary();
    } catch {
      showError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const expectedCash = register ? Number(register.expectedCash ?? 0) : 0;
  const countedNum = Number(closeForm.countedCash || 0);
  const liveDiff = countedNum - expectedCash;

  if (loading && !summary) return <LoadingSpinner message="Cargando finanzas..." />;

  return (
    <Box>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Finanzas</Typography>
          <Typography color="text.secondary">Gestión de caja, ingresos y egresos</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
          <Button
            variant="contained"
            color="success"
            disabled={!register}
            onClick={() => openTxnDialog('INCOME')}
          >
            + Ingreso manual
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={!register}
            onClick={() => openTxnDialog('EXPENSE')}
          >
            + Nuevo egreso
          </Button>
        </Box>
      </Box>

      {/* Estado de caja */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="h6" fontWeight={600}>Estado de caja</Typography>
            <Chip
              label={register ? 'ABIERTA' : 'CERRADA'}
              color={register ? 'success' : 'default'}
              size="small"
            />
            {register?.shift && (
              <Chip label={CASH_SHIFT_LABELS[register.shift] || register.shift} color="info" size="small" variant="outlined" />
            )}
            {register && (
              <Typography variant="body2" color="text.secondary">
                Abierta el {formatDate(register.openedAt)} · Saldo inicial {formatCurrency(register.openingBalance)}
              </Typography>
            )}
          </Box>
          {register ? (
            <Button variant="outlined" color="error" onClick={() => setCloseDialog(true)}>
              Cerrar caja (arqueo)
            </Button>
          ) : (
            <Button variant="contained" onClick={() => setOpenDialog(true)}>
              Abrir caja
            </Button>
          )}
        </Box>
      </Paper>

      {/* Aviso de turno */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary">
            {register
              ? '📊 Estás viendo el movimiento del turno actual (desde que abriste la caja). El total del día está en Reportes.'
              : 'No hay caja abierta. Abrí la caja para empezar a registrar el turno. El historial del día está en Reportes.'}
          </Typography>
          <Button variant="text" onClick={loadSummary} disabled={loading}>Actualizar</Button>
        </Box>
      </Paper>

      {/* Stat cards */}
      {totals && (
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard title="Ingresos del turno" value={formatCurrency(totals.totalIncome)} icon="💰" color="#2E7D32" />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard title="Egresos del turno" value={formatCurrency(totals.totalExpense)} icon="📉" color="#C62828" />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard title="Resultado neto del turno" value={formatCurrency(totals.net)} icon="⚖️" color="#1565C0" />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <StatCard
              title="Efectivo real en caja"
              value={register ? formatCurrency(expectedCash) : '— caja cerrada'}
              icon="🧾"
              color="#E65100"
            />
          </Grid>
        </Grid>
      )}

      <Grid container spacing={3}>
        {/* Libro de movimientos */}
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>Libro de movimientos del turno</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell><strong>Hora</strong></TableCell>
                    <TableCell><strong>Concepto</strong></TableCell>
                    <TableCell><strong>Método</strong></TableCell>
                    <TableCell align="right"><strong>Monto</strong></TableCell>
                    <TableCell align="center" width={48}></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {ledger.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                        {register ? 'Sin movimientos en el turno' : 'Abrí la caja para registrar el turno'}
                      </TableCell>
                    </TableRow>
                  )}
                  {ledger.map((row) => {
                    const isIncome = row.type === 'INCOME';
                    return (
                      <TableRow key={row.id} hover>
                        <TableCell>
                          {new Date(row.time).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500}>
                            {row.category}{row.employeeName ? ` — ${row.employeeName}` : ''}
                          </Typography>
                          {row.description && (
                            <Typography variant="caption" color="text.secondary">{row.description}</Typography>
                          )}
                          {row.source === 'ORDER' && (
                            <Chip label="Venta" size="small" sx={{ ml: 1, height: 18 }} />
                          )}
                        </TableCell>
                        <TableCell>
                          {FINANCE_PAYMENT_METHOD_LABELS[row.paymentMethod] || row.paymentMethod}
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            color={isIncome ? 'success.main' : 'error.main'}
                          >
                            {isIncome ? '+' : '−'} {formatCurrency(row.amount)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center" sx={{ p: 0.5 }}>
                          {row.source === 'MANUAL' ? (
                            <Tooltip title="Eliminar movimiento">
                              <IconButton size="small" color="error" onClick={() => handleDeleteTxn(row.id)}>
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Desglose + historial */}
        <Grid item xs={12} md={5}>
          {totals && (
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>Desglose del turno</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Row label="Ventas de pedidos" value={formatCurrency(totals.orderTotalSales)} />
                <Row label="  · de las cuales en efectivo" value={formatCurrency(totals.orderCashSales)} muted />
                <Row label="Ingresos manuales" value={formatCurrency(totals.manualIncome)} />
                <Row label="Egresos manuales" value={`− ${formatCurrency(totals.manualExpense)}`} />
                <Divider sx={{ my: 1 }} />
                <Row label="Resultado neto" value={formatCurrency(totals.net)} bold />
              </Box>
            </Paper>
          )}

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>Cierres recientes</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.100' }}>
                    <TableCell><strong>Apertura</strong></TableCell>
                    <TableCell><strong>Estado</strong></TableCell>
                    <TableCell align="right"><strong>Dif.</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {history.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        Sin cajas registradas
                      </TableCell>
                    </TableRow>
                  )}
                  {history.map((r) => {
                    const diff = r.difference != null ? Number(r.difference) : null;
                    return (
                      <TableRow key={r.id} hover>
                        <TableCell>
                          {formatDate(r.openedAt)}
                          {r.shift && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {CASH_SHIFT_LABELS[r.shift] || r.shift}
                            </Typography>
                          )}
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={r.status === 'OPEN' ? 'Abierta' : 'Cerrada'}
                            color={r.status === 'OPEN' ? 'success' : 'default'}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">
                          {diff == null ? '—' : (
                            <Typography
                              variant="body2"
                              color={diff === 0 ? 'text.primary' : diff > 0 ? 'success.main' : 'error.main'}
                            >
                              {formatCurrency(diff)}
                            </Typography>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* ─── Dialog movimiento manual ─── */}
      <Dialog open={txnDialog !== null} onClose={() => setTxnDialog(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{txnDialog === 'INCOME' ? 'Nuevo ingreso manual' : 'Nuevo egreso'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Monto *"
              type="number"
              inputProps={{ min: 0, step: 0.01 }}
              value={txnForm.amount}
              onChange={(e) => setTxnForm((p) => ({ ...p, amount: e.target.value }))}
              fullWidth
            />
            <FormControl fullWidth>
              <InputLabel>Categoría *</InputLabel>
              <Select
                label="Categoría *"
                value={txnForm.category}
                onChange={(e) => setTxnForm((p) => ({ ...p, category: e.target.value, employeeId: '' }))}
              >
                {categories.map((c) => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </Select>
            </FormControl>
            {needsEmployee(txnForm.category) && (
              <FormControl fullWidth>
                <InputLabel>Empleado *</InputLabel>
                <Select
                  label="Empleado *"
                  value={txnForm.employeeId}
                  onChange={(e) => setTxnForm((p) => ({ ...p, employeeId: e.target.value }))}
                >
                  {employees.length === 0 && (
                    <MenuItem value="" disabled>No hay empleados activos cargados</MenuItem>
                  )}
                  {employees.map((emp) => (
                    <MenuItem key={emp.id} value={emp.id}>{emp.firstName} {emp.lastName}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}
            <FormControl fullWidth>
              <InputLabel>Método de pago *</InputLabel>
              <Select
                label="Método de pago *"
                value={txnForm.paymentMethod}
                onChange={(e) => setTxnForm((p) => ({ ...p, paymentMethod: e.target.value }))}
              >
                {FINANCE_PAYMENT_METHODS.map((m) => (
                  <MenuItem key={m} value={m}>{FINANCE_PAYMENT_METHOD_LABELS[m]}</MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Descripción"
              value={txnForm.description}
              onChange={(e) => setTxnForm((p) => ({ ...p, description: e.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTxnDialog(null)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSaveTxn}
            disabled={
              saving ||
              !txnForm.amount ||
              Number(txnForm.amount) <= 0 ||
              !txnForm.category ||
              (needsEmployee(txnForm.category) && !txnForm.employeeId)
            }
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Dialog abrir caja ─── */}
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
              </Select>
            </FormControl>
            <TextField
              label="Saldo inicial en efectivo *"
              type="number"
              inputProps={{ min: 0, step: 0.01 }}
              value={openForm.openingBalance}
              onChange={(e) => setOpenForm((p) => ({ ...p, openingBalance: e.target.value }))}
              fullWidth
              helperText="Efectivo con el que arranca la caja"
            />
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
          <Button variant="contained" onClick={handleOpenRegister} disabled={saving || !openForm.shift || openForm.openingBalance === ''}>
            Abrir
          </Button>
        </DialogActions>
      </Dialog>

      {/* ─── Dialog cerrar caja (arqueo) ─── */}
      <Dialog open={closeDialog} onClose={() => setCloseDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Cerrar caja — Arqueo</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography color="text.secondary">Efectivo esperado en caja</Typography>
              <Typography fontWeight={600}>{formatCurrency(expectedCash)}</Typography>
            </Box>
            <TextField
              label="Efectivo contado *"
              type="number"
              inputProps={{ min: 0, step: 0.01 }}
              value={closeForm.countedCash}
              onChange={(e) => setCloseForm((p) => ({ ...p, countedCash: e.target.value }))}
              fullWidth
              helperText="Total de efectivo físico contado en la caja"
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography color="text.secondary">Diferencia</Typography>
              <Typography
                fontWeight={700}
                color={liveDiff === 0 ? 'text.primary' : liveDiff > 0 ? 'success.main' : 'error.main'}
              >
                {formatCurrency(liveDiff)} {liveDiff === 0 ? '' : liveDiff > 0 ? '(sobrante)' : '(faltante)'}
              </Typography>
            </Box>
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
          <Button variant="contained" color="error" onClick={handleCloseRegister} disabled={saving || closeForm.countedCash === ''}>
            Cerrar caja
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function Row({ label, value, muted, bold }: { label: string; value: string; muted?: boolean; bold?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
      <Typography variant="body2" color={muted ? 'text.secondary' : 'text.primary'} sx={{ whiteSpace: 'pre' }}>
        {label}
      </Typography>
      <Typography variant="body2" fontWeight={bold ? 700 : 500}>{value}</Typography>
    </Box>
  );
}
