'use client';

import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Switch from '@mui/material/Switch';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import { formatCurrency } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useSnackbar } from '@/app/snackbar-context';

interface PostreRow {
  id: string;
  name: string;
  price: number;
  stock: number;
  available: boolean;
}
interface VentaDia {
  date: string;
  cantidad: number;
  total: number;
}
/** Totales de postres ya con descuentos prorrateados y el pago a la persona. */
interface PostreTotals {
  unidadesGrandes: number;
  unidadesChicas: number;
  unidades: number;
  bruto: number;
  descuentos: number;
  cobrado: number;
  pagoGrandes: number;
  pagoChicos: number;
  pago: number;
  resultadoNegocio: number;
}
interface PostresData {
  products: PostreRow[];
  ventasDiarias: VentaDia[];
  totalVendidos: number;
  totalIngresos: number;
  totalRetiros: number;
  dineroAFavor: number;
  stockTotal: number;
  entradas: number;
  resumenPeriodo: PostreTotals;
  resumenHistorico: PostreTotals;
  ajustes: number;
  conciliacion: {
    dineroAFavorAnterior: number;
    dineroAFavorReal: number;
    diferencia: number;
  };
  pagoActual: { GRANDE: number; CHICO: number };
}

const fmtDate = (d: string) => d.split('-').reverse().join('/');

/** Fila etiqueta/valor de los cuadros de cuentas. */
function SummaryRow({
  label,
  value,
  strong,
  color,
}: {
  label: string;
  value: string;
  strong?: boolean;
  color?: string;
}) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 1, py: 0.4 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={strong ? 800 : 500} color={color} sx={{ whiteSpace: 'nowrap' }}>
        {value}
      </Typography>
    </Box>
  );
}

export default function PostresPage() {
  const { showSuccess, showError } = useSnackbar();
  const [data, setData] = useState<PostresData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Filtros del período (afectan ventas/ingresos/entradas; el dinero a favor es saldo total).
  const [period, setPeriod] = useState<'day' | 'week' | 'month'>('month');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [shift, setShift] = useState<'BOTH' | 'MANANA' | 'NOCHE'>('BOTH');

  // Modal cargar stock
  const [cargarOpen, setCargarOpen] = useState(false);
  const [cargarQty, setCargarQty] = useState<Record<string, string>>({});

  // Modal retirar dinero
  const [retirarOpen, setRetirarOpen] = useState(false);
  const [retirarForm, setRetirarForm] = useState({ reason: '', amount: '' });

  // Modal editar precio
  const [priceCtx, setPriceCtx] = useState<PostreRow | null>(null);
  const [priceValue, setPriceValue] = useState('');

  // Modal "pago por postre" (lo que se le paga a la persona de postres)
  const [pagoOpen, setPagoOpen] = useState(false);
  const [pagoForm, setPagoForm] = useState({ GRANDE: '', CHICO: '' });

  const load = () => {
    setLoading(true);
    const qs = new URLSearchParams({ period, date, shift });
    fetch(`/api/admin/postres?${qs}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setData(d.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [period, date, shift]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleActive = async (p: PostreRow) => {
    try {
      const res = await fetch(`/api/products/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: !p.available }),
      });
      if (!res.ok) throw new Error();
      setData((prev) => prev && {
        ...prev,
        products: prev.products.map((x) => (x.id === p.id ? { ...x, available: !x.available } : x)),
      });
      showSuccess(`Postre ${!p.available ? 'activado' : 'desactivado'}`);
    } catch {
      showError('Error al actualizar el postre');
    }
  };

  const openPrice = (p: PostreRow) => { setPriceValue(String(p.price)); setPriceCtx(p); };

  const savePrice = async () => {
    if (!priceCtx) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/products/${priceCtx.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: Number(priceValue) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { showError(json.error || 'Error al guardar el precio'); return; }
      showSuccess('Precio actualizado');
      setPriceCtx(null);
      load();
    } catch {
      showError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const openPago = () => {
    if (!data) return;
    setPagoForm({ GRANDE: String(data.pagoActual.GRANDE), CHICO: String(data.pagoActual.CHICO) });
    setPagoOpen(true);
  };

  const savePago = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/postres/payout', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ GRANDE: Number(pagoForm.GRANDE), CHICO: Number(pagoForm.CHICO) }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { showError(json.error || 'No se pudo guardar el pago'); return; }
      showSuccess('Pago actualizado. Rige para las ventas de acá en adelante.');
      setPagoOpen(false);
      load();
    } catch {
      showError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const openCargar = () => { setCargarQty({}); setCargarOpen(true); };

  const handleCargar = async () => {
    const entries = Object.entries(cargarQty)
      .map(([productId, q]) => ({ productId, quantity: Math.floor(Number(q)) }))
      .filter((e) => e.quantity > 0);
    if (entries.length === 0) { showError('Ingresá al menos una cantidad'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/postres/stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entries }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { showError(json.error || 'Error al cargar stock'); return; }
      showSuccess('Stock cargado');
      setCargarOpen(false);
      load();
    } catch {
      showError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleRetirar = async () => {
    const amount = Number(retirarForm.amount);
    if (!(amount > 0)) { showError('Ingresá un importe válido'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/admin/postres/withdraw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, reason: retirarForm.reason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { showError(json.error || 'Error al registrar el retiro'); return; }
      showSuccess('Retiro registrado · descontado del dinero a favor');
      setRetirarOpen(false);
      setRetirarForm({ reason: '', amount: '' });
      load();
    } catch {
      showError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) return <LoadingSpinner message="Cargando postres..." />;
  if (!data) return <Typography color="error">No se pudieron cargar los datos.</Typography>;

  // Métricas del período seleccionado (+ "Total retirado" que es saldo histórico).
  const metrics = [
    { label: 'Vendidos del período (unidades)', value: String(data.totalVendidos), color: 'text.primary' },
    { label: 'Ingresos del período (bruto)', value: formatCurrency(data.totalIngresos), color: 'success.main' },
    { label: 'Entradas del período (carga)', value: String(data.entradas), color: 'info.main' },
    { label: 'Total retirado (histórico)', value: formatCurrency(data.totalRetiros), color: 'error.main' },
  ];

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>🍰 Postres</Typography>
          <Typography color="text.secondary">Stock, ventas y dinero a favor de los postres</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button variant="contained" onClick={openCargar}>📥 Cargar stock</Button>
          <Button variant="outlined" onClick={openPago}>🧾 Pago por postre</Button>
          <Button variant="outlined" color="warning" onClick={() => setRetirarOpen(true)}>💸 Retirar dinero</Button>
        </Box>
      </Box>

      {/* Filtros de período/turno (afectan las métricas del período, no el saldo) */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            {(['day', 'week', 'month'] as const).map((p) => (
              <Button key={p} size="small" variant={period === p ? 'contained' : 'outlined'} onClick={() => setPeriod(p)}>
                {p === 'day' ? 'Día' : p === 'week' ? 'Semana' : 'Mes'}
              </Button>
            ))}
          </Box>
          <TextField
            type="date"
            size="small"
            label="Fecha"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button size="small" variant={shift === 'BOTH' ? 'contained' : 'outlined'} onClick={() => setShift('BOTH')}>Ambos turnos</Button>
            <Button size="small" variant={shift === 'MANANA' ? 'contained' : 'outlined'} onClick={() => setShift('MANANA')}>🌅 Mañana</Button>
            <Button size="small" variant={shift === 'NOCHE' ? 'contained' : 'outlined'} onClick={() => setShift('NOCHE')}>🌙 Noche</Button>
          </Box>
        </Box>
      </Paper>

      {/* Resumen */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2.5, borderRadius: 2, border: '2px solid', borderColor: 'success.main', height: '100%' }}>
            <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>DINERO A FAVOR</Typography>
            <Typography variant="h4" fontWeight={800} color={data.dineroAFavor >= 0 ? 'success.main' : 'error.main'}>
              {formatCurrency(data.dineroAFavor)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Saldo real: lo que se le debe por lo vendido − retiros + ajustes
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2.5, borderRadius: 2, border: '2px solid', borderColor: 'info.main', height: '100%' }}>
            <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>STOCK TOTAL DE POSTRES</Typography>
            <Typography variant="h3" fontWeight={800} color={data.stockTotal <= 0 ? 'error.main' : 'info.main'}>
              {data.stockTotal}
            </Typography>
            <Typography variant="caption" color="text.secondary">Suma del stock actual de todos los postres</Typography>
          </Paper>
        </Grid>
        {metrics.map((m) => (
          <Grid item xs={6} sm={6} md={3} key={m.label}>
            <Paper sx={{ p: 2.5, borderRadius: 2, border: '1px solid', borderColor: 'grey.200', height: '100%' }}>
              <Typography variant="caption" color="text.secondary" display="block">{m.label}</Typography>
              <Typography variant="h5" fontWeight={700} color={m.color}>{m.value}</Typography>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* ── Cuentas de postres ─────────────────────────────────────────────
          Tres columnas que responden, en orden: qué se vendió, cuánto se le
          debe a la persona de postres, y qué le queda al negocio. Las cifras
          de venta son del PERÍODO elegido arriba; el pago acumulado y el saldo
          son históricos (no dependen del filtro). */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2.5, height: '100%' }}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              VENTAS DEL PERÍODO
            </Typography>
            <SummaryRow label="Postres grandes" value={String(data.resumenPeriodo.unidadesGrandes)} />
            <SummaryRow label="Postres chicos" value={String(data.resumenPeriodo.unidadesChicas)} />
            <SummaryRow label="Total bruto vendido" value={formatCurrency(data.resumenPeriodo.bruto)} />
            <SummaryRow
              label="Descuentos aplicados"
              value={`− ${formatCurrency(data.resumenPeriodo.descuentos)}`}
              color={data.resumenPeriodo.descuentos > 0 ? 'warning.main' : undefined}
            />
            <SummaryRow label="Cobrado a los clientes" value={formatCurrency(data.resumenPeriodo.cobrado)} strong />
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2.5, height: '100%' }}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              PAGO A LA PERSONA DE POSTRES
            </Typography>
            <SummaryRow
              label={`Grandes (${formatCurrency(data.pagoActual.GRANDE)} c/u)`}
              value={formatCurrency(data.resumenPeriodo.pagoGrandes)}
            />
            <SummaryRow
              label={`Chicos (${formatCurrency(data.pagoActual.CHICO)} c/u)`}
              value={formatCurrency(data.resumenPeriodo.pagoChicos)}
            />
            <SummaryRow label="Total del período" value={formatCurrency(data.resumenPeriodo.pago)} strong />
            <SummaryRow
              label="Acumulado histórico"
              value={formatCurrency(data.resumenHistorico.pago)}
            />
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
              Cada venta se paga con la tarifa que regía ese día.
            </Typography>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2.5, height: '100%' }}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              RESULTADO DEL NEGOCIO
            </Typography>
            <SummaryRow label="Cobrado por postres" value={formatCurrency(data.resumenPeriodo.cobrado)} />
            <SummaryRow label="Menos pago a la persona" value={`− ${formatCurrency(data.resumenPeriodo.pago)}`} />
            <Box sx={{ borderTop: '1px solid', borderColor: 'divider', mt: 1, pt: 1 }}>
              <Typography
                variant="h5"
                fontWeight={800}
                color={data.resumenPeriodo.resultadoNegocio >= 0 ? 'success.main' : 'error.main'}
              >
                {formatCurrency(data.resumenPeriodo.resultadoNegocio)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {data.resumenPeriodo.resultadoNegocio >= 0
                  ? 'Le queda al negocio en el período'
                  : 'El negocio PIERDE en el período (el descuento deja el cobro por debajo del pago)'}
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Conciliación: sólo tiene sentido mientras el número viejo y el nuevo
          difieran. Es informativa: no cambia ni un movimiento. */}
      {Math.abs(data.conciliacion.diferencia) >= 1 && (
        <Paper sx={{ p: 2.5, mb: 3, border: '1px solid', borderColor: 'warning.light', bgcolor: 'warning.50' }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>
            ⚠️ CONCILIACIÓN DEL DINERO A FAVOR
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            El cálculo anterior acreditaba el <strong>precio de venta completo</strong> del postre en vez
            de lo que se le paga a la persona. Éste es el impacto de la corrección sobre el saldo. No se
            borró ni modificó ningún retiro ni ajuste.
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <SummaryRow label="Saldo con el cálculo viejo" value={formatCurrency(data.conciliacion.dineroAFavorAnterior)} />
            </Grid>
            <Grid item xs={12} sm={4}>
              <SummaryRow label="Saldo real (nuevo)" value={formatCurrency(data.conciliacion.dineroAFavorReal)} strong />
            </Grid>
            <Grid item xs={12} sm={4}>
              <SummaryRow
                label="Diferencia"
                value={formatCurrency(data.conciliacion.diferencia)}
                color={data.conciliacion.diferencia >= 0 ? 'success.main' : 'error.main'}
                strong
              />
            </Grid>
          </Grid>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1.5 }}>
            Desglose del saldo real: pago por lo vendido {formatCurrency(data.resumenHistorico.pago)} −
            retiros {formatCurrency(data.totalRetiros)}
            {data.ajustes !== 0 ? ` ${data.ajustes >= 0 ? '+' : '−'} ajustes ${formatCurrency(Math.abs(data.ajustes))}` : ''}
            {' '}= {formatCurrency(data.dineroAFavor)}
          </Typography>
        </Paper>
      )}

      <Grid container spacing={3}>
        {/* Stock de postres */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>Stock de postres</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Postre</strong></TableCell>
                    <TableCell align="right"><strong>Precio</strong></TableCell>
                    <TableCell align="center"><strong>Stock</strong></TableCell>
                    <TableCell align="center"><strong>Activo</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.products.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        No hay postres cargados. Crealos en Productos (categoría Postres).
                      </TableCell>
                    </TableRow>
                  )}
                  {data.products.map((p) => (
                    <TableRow key={p.id} hover>
                      <TableCell>{p.name}</TableCell>
                      <TableCell align="right">
                        <Button size="small" onClick={() => openPrice(p)} sx={{ textTransform: 'none' }}>
                          {formatCurrency(p.price)}
                        </Button>
                      </TableCell>
                      <TableCell align="center">
                        <Typography fontWeight={700} color={p.stock <= 0 ? 'error.main' : 'text.primary'}>
                          {p.stock}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Switch checked={p.available} onChange={() => toggleActive(p)} size="small" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        {/* Ventas diarias */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>Ventas diarias</Typography>
            <TableContainer sx={{ maxHeight: 420 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Fecha</strong></TableCell>
                    <TableCell align="right"><strong>Cantidad</strong></TableCell>
                    <TableCell align="right"><strong>Total</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.ventasDiarias.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                        Todavía no hay ventas de postres registradas.
                      </TableCell>
                    </TableRow>
                  )}
                  {data.ventasDiarias.map((v) => (
                    <TableRow key={v.date} hover>
                      <TableCell>{fmtDate(v.date)}</TableCell>
                      <TableCell align="right">{v.cantidad}</TableCell>
                      <TableCell align="right">{formatCurrency(v.total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      {/* Modal: cargar stock */}
      <Dialog open={cargarOpen} onClose={() => setCargarOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Cargar stock de postres</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Escribí la cantidad que ingresa de cada postre. Se suma al stock actual.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {data.products.map((p) => (
              <Box key={p.id} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="body2" fontWeight={500}>{p.name}</Typography>
                  <Typography variant="caption" color="text.secondary">Stock: {p.stock}</Typography>
                </Box>
                <TextField
                  type="number"
                  size="small"
                  placeholder="0"
                  inputProps={{ min: 0, step: 1, style: { width: 70 } }}
                  value={cargarQty[p.id] ?? ''}
                  onChange={(e) => setCargarQty((prev) => ({ ...prev, [p.id]: e.target.value }))}
                />
              </Box>
            ))}
            {data.products.length === 0 && (
              <Typography color="text.secondary">No hay postres cargados.</Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCargarOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleCargar} disabled={saving || data.products.length === 0}>
            Finalizar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal: retirar dinero */}
      <Dialog open={retirarOpen} onClose={() => setRetirarOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Retirar dinero de postres</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Disponible a favor: <strong>{formatCurrency(data.dineroAFavor)}</strong>
            </Typography>
            <TextField
              label="Motivo del retiro"
              value={retirarForm.reason}
              onChange={(e) => setRetirarForm((p) => ({ ...p, reason: e.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="Importe a retirar *"
              type="number"
              inputProps={{ min: 0, step: 0.01 }}
              value={retirarForm.amount}
              onChange={(e) => setRetirarForm((p) => ({ ...p, amount: e.target.value }))}
              fullWidth
              autoFocus
              InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            />
            <Typography variant="caption" color="text.secondary">
              Solo se descuenta del dinero a favor de postres. No impacta en Finanzas
              (si corresponde un egreso, cargalo a mano).
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRetirarOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleRetirar}
            disabled={saving || !retirarForm.amount || Number(retirarForm.amount) <= 0}
          >
            Retirar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal: pago por postre (lo que se le paga a la persona de postres) */}
      <Dialog open={pagoOpen} onClose={() => setPagoOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Pago por postre</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Cuánto se le paga a la persona de postres por cada uno. Es el valor que se descuenta del
            precio de venta para saber qué le queda al negocio.
          </Typography>
          <TextField
            fullWidth
            label="Postre grande"
            type="number"
            value={pagoForm.GRANDE}
            onChange={(e) => setPagoForm((f) => ({ ...f, GRANDE: e.target.value }))}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Postre chico"
            type="number"
            value={pagoForm.CHICO}
            onChange={(e) => setPagoForm((f) => ({ ...f, CHICO: e.target.value }))}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
          />
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 2 }}>
            ⚠️ El valor nuevo rige <strong>de ahora en adelante</strong>. Las ventas ya hechas se siguen
            pagando con la tarifa que correspondía ese día: cambiar esto no recalcula el pasado.
          </Typography>
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
            El tamaño de cada postre sale de su nombre: el que dice “chico” o “chica” cuenta como chico,
            el resto como grande.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPagoOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={savePago} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Modal: editar precio */}
      <Dialog open={priceCtx !== null} onClose={() => setPriceCtx(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Precio · {priceCtx?.name}</DialogTitle>
        <DialogContent>
          <TextField
            label="Precio *"
            type="number"
            inputProps={{ min: 0, step: 0.01 }}
            value={priceValue}
            onChange={(e) => setPriceValue(e.target.value)}
            fullWidth
            autoFocus
            sx={{ mt: 1 }}
            InputProps={{ startAdornment: <InputAdornment position="start">$</InputAdornment> }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPriceCtx(null)}>Cancelar</Button>
          <Button variant="contained" onClick={savePrice} disabled={saving || priceValue === '' || Number(priceValue) < 0}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
