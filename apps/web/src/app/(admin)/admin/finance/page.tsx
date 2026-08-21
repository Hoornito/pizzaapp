'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import FormHelperText from '@mui/material/FormHelperText';
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
  FINANCE_CATEGORY_PROPINA,
  FINANCE_CATEGORY_RETIRO_EMPLEADO,
} from '@/lib/constants';

type TxnType = 'INCOME' | 'EXPENSE';

interface TxnForm {
  amount: string;
  cashAmount: string;
  virtualAmount: string;
  category: string;
  description: string;
  paymentMethod: string;
  employeeId: string;
  accumulate: string;
  devolucionAdelanto: string;
}

const emptyForm: TxnForm = { amount: '', cashAmount: '', virtualAmount: '', category: '', description: '', paymentMethod: 'EFECTIVO', employeeId: '', accumulate: '', devolucionAdelanto: '' };

const needsEmployee = (category: string) =>
  category === FINANCE_CATEGORY_SUELDOS ||
  category === FINANCE_CATEGORY_ADELANTOS ||
  category === FINANCE_CATEGORY_PROPINA ||
  category === FINANCE_CATEGORY_RETIRO_EMPLEADO;

function FinanceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
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

  // Se recarga después de cada movimiento: los saldos de los empleados (lo que
  // tienen guardado) cambian con los retiros y con los sueldos que acumulan.
  const loadEmployees = useCallback(() => {
    fetch('/api/admin/employees?active=true')
      .then((r) => r.json())
      .then((d) => setEmployees(d.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => { loadEmployees(); }, [loadEmployees]);

  // Atajo desde Empleados (?retiro=<id>): abre el egreso de retiro con ese
  // empleado ya elegido. Después limpiamos la URL para que un refresh —o volver
  // con el botón de atrás— no lo reabra solo.
  const retiroEmpleadoId = searchParams.get('retiro');
  useEffect(() => {
    if (!retiroEmpleadoId) return;
    setTxnForm({
      ...emptyForm,
      category: FINANCE_CATEGORY_RETIRO_EMPLEADO,
      employeeId: retiroEmpleadoId,
    });
    setTxnDialog('EXPENSE');
    router.replace('/admin/finance');
  }, [retiroEmpleadoId, router]);

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

  // ─── Derivados del formulario ──────────────────────────────────────────
  const esRetiroEmpleado = txnForm.category === FINANCE_CATEGORY_RETIRO_EMPLEADO;
  const empleadoSeleccionado = employees.find((e) => e.id === txnForm.employeeId) ?? null;
  // Lo que el empleado tiene guardado hoy (acumulado a favor).
  const guardadoDisponible = Number(empleadoSeleccionado?.acumulado ?? 0);
  // En mixto el total sale de sumar los dos campos, que se cargan a mano: nunca
  // se parte de un total para repartirlo.
  const montoTotal =
    txnForm.paymentMethod === 'MIXTO'
      ? Number(txnForm.cashAmount || 0) + Number(txnForm.virtualAmount || 0)
      : Number(txnForm.amount || 0);
  // Un centavo de tolerancia: los montos son Decimal(10,2) y retirar el total
  // exacto no tiene que rebotar por un redondeo.
  // Si la lista de empleados todavía no cargó, no marcamos exceso: el saldo se
  // leería como 0 y el formulario se pintaría en rojo por un instante.
  const retiroExcedido =
    esRetiroEmpleado && empleadoSeleccionado !== null && montoTotal > guardadoDisponible + 0.001;

  const handleSaveTxn = async () => {
    if (!txnDialog) return;
    setSaving(true);
    try {
      const isSueldo = txnForm.category === FINANCE_CATEGORY_SUELDOS;
      const isMixto = txnForm.paymentMethod === 'MIXTO';
      // En mixto el total = efectivo + virtual (ambos a mano).
      // En Sueldos, el monto (retiro de caja) puede quedar en 0 si todo va "a favor".
      const amount = montoTotal;
      const res = await fetch('/api/admin/finance/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: txnDialog,
          amount,
          cashAmount: isMixto ? Number(txnForm.cashAmount || 0) : null,
          category: txnForm.category,
          description: txnForm.description || null,
          paymentMethod: txnForm.paymentMethod,
          employeeId: needsEmployee(txnForm.category) ? txnForm.employeeId || null : null,
          accumulate: isSueldo && txnForm.accumulate ? Number(txnForm.accumulate) : null,
          devolucionAdelanto: isSueldo && txnForm.devolucionAdelanto ? Number(txnForm.devolucionAdelanto) : null,
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
      loadEmployees();
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
      // Borrar un retiro/adelanto le devuelve el saldo al empleado.
      loadEmployees();
    } catch {
      showError('Error de conexión');
    }
  };

  // ─── Caja ──────────────────────────────────────────────────────────────
  const handleOpenRegister = async () => {
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
    setSaving(true);
    try {
      const res = await fetch('/api/admin/finance/cash-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shift: isTest ? null : openForm.shift,
          isTest,
          openingBalance: Number(openForm.openingBalance || 0),
          notes: openForm.notes || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showError(json.error || 'Error al abrir la caja');
        return;
      }
      showSuccess(isTest ? 'Simulación iniciada' : 'Caja abierta');
      setOpenDialog(false);
      setOpenForm({ shift: '', openingBalance: '', notes: '' });
      loadSummary();
    } catch {
      showError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  // Cierre de una caja de simulación: borra los datos de prueba (sin arqueo).
  const handleCloseTest = async () => {
    if (
      !window.confirm(
        'Vas a cerrar la SIMULACIÓN. Se borrarán todos los pedidos y movimientos de prueba cargados. ¿Continuar?'
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/finance/cash-register/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ countedCash: 0 }),
      });
      const json = await res.json();
      if (!res.ok) {
        showError(json.error || 'Error al cerrar la simulación');
        return;
      }
      showSuccess('Simulación finalizada. Se borraron los datos de prueba.');
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

      {register?.isTest && (
        <Alert severity="warning" sx={{ mb: 3 }}>
          🧪 <strong>MODO SIMULACIÓN</strong> — Estás en una caja de entrenamiento. Los pedidos y
          movimientos que cargues <strong>no quedan registrados</strong> y se borran al cerrar la simulación.
        </Alert>
      )}

      {/* Estado de caja */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
            <Typography variant="h6" fontWeight={600}>Estado de caja</Typography>
            <Chip
              label={register ? (register.isTest ? 'SIMULACIÓN' : 'ABIERTA') : 'CERRADA'}
              color={register ? (register.isTest ? 'warning' : 'success') : 'default'}
              size="small"
            />
            {register?.isTest && <Chip label="=== TEST ===" color="warning" size="small" variant="outlined" />}
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
            register.isTest ? (
              <Button variant="outlined" color="warning" onClick={handleCloseTest} disabled={saving}>
                Cerrar simulación
              </Button>
            ) : (
              <Button variant="outlined" color="error" onClick={() => setCloseDialog(true)}>
                Cerrar caja (arqueo)
              </Button>
            )
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
                            <Typography variant="caption" color="text.secondary" display="block">{row.description}</Typography>
                          )}
                          {(row.accumulate ?? 0) > 0 && (
                            <Typography variant="caption" color="info.main" display="block">
                              ↳ Acumula a favor: {formatCurrency(row.accumulate)} (no sale de caja)
                            </Typography>
                          )}
                          {row.source === 'ORDER' && (
                            <Chip label="Venta" size="small" sx={{ ml: 1, height: 18 }} />
                          )}
                        </TableCell>
                        <TableCell>
                          {FINANCE_PAYMENT_METHOD_LABELS[row.paymentMethod] || row.paymentMethod}
                        </TableCell>
                        <TableCell align="right">
                          {row.amount > 0 || (row.accumulate ?? 0) <= 0 ? (
                            <Typography
                              variant="body2"
                              fontWeight={600}
                              color={isIncome ? 'success.main' : 'error.main'}
                            >
                              {isIncome ? '+' : '−'} {formatCurrency(row.amount)}
                            </Typography>
                          ) : (
                            // Sueldo que quedó todo a favor: no sale de caja.
                            <Typography variant="body2" fontWeight={600} color="info.main">
                              {formatCurrency(row.accumulate)}
                            </Typography>
                          )}
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
            {/* 1. Categoría del egreso/ingreso */}
            <FormControl fullWidth>
              <InputLabel>Categoría *</InputLabel>
              <Select
                label="Categoría *"
                value={txnForm.category}
                onChange={(e) =>
                  setTxnForm((p) => ({
                    ...p,
                    category: e.target.value,
                    employeeId: '',
                    // La propina siempre es en efectivo, y al empleado no se le
                    // paga con la tarjeta del local: en ambos casos corregimos
                    // el método si el que había quedado ya no aplica.
                    paymentMethod:
                      e.target.value === FINANCE_CATEGORY_PROPINA ||
                      (e.target.value === FINANCE_CATEGORY_RETIRO_EMPLEADO && p.paymentMethod === 'TARJETA')
                        ? 'EFECTIVO'
                        : p.paymentMethod,
                  }))
                }
              >
                {categories.map((c) => (
                  <MenuItem key={c} value={c}>{c}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* 2. Empleado (sueldos / adelantos) o Repartidor (propina) */}
            {needsEmployee(txnForm.category) && (() => {
              const esPropina = txnForm.category === FINANCE_CATEGORY_PROPINA;
              const opciones = esPropina ? employees.filter((emp) => emp.role === 'REPARTIDOR') : employees;
              const label = esPropina ? 'Repartidor *' : 'Empleado *';
              return (
                <FormControl fullWidth>
                  <InputLabel>{label}</InputLabel>
                  <Select
                    label={label}
                    value={txnForm.employeeId}
                    onChange={(e) => setTxnForm((p) => ({ ...p, employeeId: e.target.value }))}
                  >
                    {opciones.length === 0 && (
                      <MenuItem value="" disabled>
                        {esPropina ? 'No hay repartidores cargados' : 'No hay empleados activos cargados'}
                      </MenuItem>
                    )}
                    {opciones.map((emp) => (
                      // En el retiro mostramos cuánto tiene guardado cada uno, así
                      // no hay que ir hasta Empleados a fijarse.
                      <MenuItem key={emp.id} value={emp.id}>
                        {emp.firstName} {emp.lastName}
                        {esRetiroEmpleado ? ` — guardado: ${formatCurrency(Number(emp.acumulado ?? 0))}` : ''}
                      </MenuItem>
                    ))}
                  </Select>
                  {esRetiroEmpleado && empleadoSeleccionado && (
                    <FormHelperText>
                      Tiene guardado {formatCurrency(guardadoDisponible)}. No puede retirar más que eso.
                    </FormHelperText>
                  )}
                </FormControl>
              );
            })()}

            {/* 3. Método de pago (la propina queda fija en efectivo) */}
            <FormControl fullWidth>
              <InputLabel>{esRetiroEmpleado ? 'Método de retiro *' : 'Método de pago *'}</InputLabel>
              <Select
                label={esRetiroEmpleado ? 'Método de retiro *' : 'Método de pago *'}
                value={txnForm.paymentMethod}
                disabled={txnForm.category === FINANCE_CATEGORY_PROPINA}
                onChange={(e) => setTxnForm((p) => ({ ...p, paymentMethod: e.target.value }))}
              >
                {FINANCE_PAYMENT_METHODS
                  // "Mixto" solo tiene sentido en egresos.
                  .filter((m) => m !== 'MIXTO' || txnDialog === 'EXPENSE')
                  // Al empleado se le da la plata en mano o por transferencia.
                  .filter((m) => m !== 'TARJETA' || !esRetiroEmpleado)
                  .map((m) => (
                    <MenuItem key={m} value={m}>{FINANCE_PAYMENT_METHOD_LABELS[m]}</MenuItem>
                  ))}
              </Select>
            </FormControl>

            {/* 4. Monto (debajo del método). En mixto: efectivo + virtual, ambos a mano. */}
            {txnForm.paymentMethod === 'MIXTO' ? (
              <Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                  <TextField
                    label="En efectivo *"
                    type="number"
                    inputProps={{ min: 0, step: 0.01 }}
                    value={txnForm.cashAmount}
                    error={retiroExcedido}
                    onChange={(e) => setTxnForm((p) => ({ ...p, cashAmount: e.target.value }))}
                  />
                  <TextField
                    // En el retiro la parte virtual siempre es una transferencia.
                    label={esRetiroEmpleado ? 'Transferencia *' : 'Virtual *'}
                    type="number"
                    inputProps={{ min: 0, step: 0.01 }}
                    value={txnForm.virtualAmount}
                    error={retiroExcedido}
                    onChange={(e) => setTxnForm((p) => ({ ...p, virtualAmount: e.target.value }))}
                  />
                </Box>
                {/* Cada campo se carga a mano: el total es la suma, no un reparto. */}
                <FormHelperText error={retiroExcedido}>
                  {retiroExcedido
                    ? `Entre los dos suman ${formatCurrency(montoTotal)} y sólo tiene guardado ${formatCurrency(guardadoDisponible)}.`
                    : `Total a entregar: ${formatCurrency(montoTotal)}`}
                </FormHelperText>
              </Box>
            ) : (
              <TextField
                label={txnForm.category === FINANCE_CATEGORY_SUELDOS ? 'Retira de caja (opcional)' : 'Monto *'}
                type="number"
                inputProps={{ min: 0, step: 0.01 }}
                value={txnForm.amount}
                onChange={(e) => setTxnForm((p) => ({ ...p, amount: e.target.value }))}
                fullWidth
                error={retiroExcedido}
                helperText={
                  txnForm.category === FINANCE_CATEGORY_SUELDOS
                    ? 'Lo que el empleado se lleva ahora (sale de caja). Si todo queda a favor, dejalo vacío.'
                    : esRetiroEmpleado
                      ? retiroExcedido
                        ? `No puede retirar más de ${formatCurrency(guardadoDisponible)}.`
                        : empleadoSeleccionado
                          ? `Máximo ${formatCurrency(guardadoDisponible)}.`
                          : 'Elegí primero el empleado.'
                      : undefined
                }
              />
            )}

            {/* 5. Acumula a favor (solo sueldos) */}
            {txnForm.category === FINANCE_CATEGORY_SUELDOS && (
              <TextField
                label="Acumula a favor (opcional)"
                type="number"
                inputProps={{ min: 0, step: 0.01 }}
                value={txnForm.accumulate}
                onChange={(e) => setTxnForm((p) => ({ ...p, accumulate: e.target.value }))}
                fullWidth
                helperText="Monto que el empleado deja a favor (no sale de caja). Se suma a su acumulado en Empleados. Podés cargar solo esto y dejar el retiro vacío."
              />
            )}

            {/* 5b. Devolución de adelanto (solo sueldos) */}
            {txnForm.category === FINANCE_CATEGORY_SUELDOS && (
              <TextField
                label="Devolución de adelanto (opcional)"
                type="number"
                inputProps={{ min: 0, step: 0.01 }}
                value={txnForm.devolucionAdelanto}
                onChange={(e) => setTxnForm((p) => ({ ...p, devolucionAdelanto: e.target.value }))}
                fullWidth
                helperText="Monto que el empleado devuelve de su adelanto. Descuenta directamente su adelanto pendiente en Empleados."
              />
            )}

            {/* 6. Descripción */}
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
        <DialogActions sx={{ justifyContent: 'space-between', px: 3 }}>
          {/* En Sueldos, corroborar cuánto se le liquida en total al empleado. */}
          {txnForm.category === FINANCE_CATEGORY_SUELDOS ? (
            (() => {
              const retira =
                txnForm.paymentMethod === 'MIXTO'
                  ? Number(txnForm.cashAmount || 0) + Number(txnForm.virtualAmount || 0)
                  : Number(txnForm.amount || 0);
              const sueldoTotal = retira + Number(txnForm.accumulate || 0) + Number(txnForm.devolucionAdelanto || 0);
              return (
                <Box>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Sueldo total (retira + acumula + devolución)
                  </Typography>
                  <Typography variant="h6" fontWeight={800} color="primary.main">
                    {formatCurrency(sueldoTotal)}
                  </Typography>
                </Box>
              );
            })()
          ) : esRetiroEmpleado && empleadoSeleccionado ? (
            // Corroborar con qué se queda el empleado después del retiro.
            <Box>
              <Typography variant="caption" color="text.secondary" display="block">
                Le queda guardado
              </Typography>
              <Typography
                variant="h6"
                fontWeight={800}
                color={retiroExcedido ? 'error.main' : 'primary.main'}
              >
                {formatCurrency(guardadoDisponible - montoTotal)}
              </Typography>
            </Box>
          ) : (
            <Box />
          )}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button onClick={() => setTxnDialog(null)}>Cancelar</Button>
            <Button
              variant="contained"
              onClick={handleSaveTxn}
              disabled={(() => {
                if (saving || !txnForm.category) return true;
                if (needsEmployee(txnForm.category) && !txnForm.employeeId) return true;
                // No se puede retirar más de lo que el empleado tiene guardado.
                if (retiroExcedido) return true;
                if (txnForm.paymentMethod === 'MIXTO') {
                  return !(Number(txnForm.cashAmount) > 0) || !(Number(txnForm.virtualAmount) > 0);
                }
                // Sueldos: alcanza con el retiro O con lo que acumula a favor.
                if (txnForm.category === FINANCE_CATEGORY_SUELDOS) {
                  return !(Number(txnForm.amount) > 0 || Number(txnForm.accumulate) > 0);
                }
                return !(Number(txnForm.amount) > 0);
              })()}
            >
              Guardar
            </Button>
          </Box>
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
            onClick={handleOpenRegister}
            disabled={saving || !openForm.shift || (openForm.shift !== 'TEST' && openForm.openingBalance === '')}
          >
            {openForm.shift === 'TEST' ? 'Iniciar simulación' : 'Abrir'}
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

// useSearchParams() exige un límite de Suspense para poder prerenderar la página.
export default function FinancePage() {
  return (
    <Suspense fallback={<LoadingSpinner />}>
      <FinanceContent />
    </Suspense>
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
