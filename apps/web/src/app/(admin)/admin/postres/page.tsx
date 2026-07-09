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
interface PostresData {
  products: PostreRow[];
  ventasDiarias: VentaDia[];
  totalVendidos: number;
  totalIngresos: number;
  totalRetiros: number;
  dineroAFavor: number;
}

const fmtDate = (d: string) => d.split('-').reverse().join('/');

export default function PostresPage() {
  const { showSuccess, showError } = useSnackbar();
  const [data, setData] = useState<PostresData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal cargar stock
  const [cargarOpen, setCargarOpen] = useState(false);
  const [cargarQty, setCargarQty] = useState<Record<string, string>>({});

  // Modal retirar dinero
  const [retirarOpen, setRetirarOpen] = useState(false);
  const [retirarForm, setRetirarForm] = useState({ reason: '', amount: '' });

  // Modal editar precio
  const [priceCtx, setPriceCtx] = useState<PostreRow | null>(null);
  const [priceValue, setPriceValue] = useState('');

  const load = () => {
    fetch('/api/admin/postres')
      .then((r) => r.json())
      .then((d) => setData(d.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

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

  if (loading) return <LoadingSpinner message="Cargando postres..." />;
  if (!data) return <Typography color="error">No se pudieron cargar los datos.</Typography>;

  const metrics = [
    { label: 'Total vendidos (unidades)', value: String(data.totalVendidos), color: 'text.primary' },
    { label: 'Ingresos por postres', value: formatCurrency(data.totalIngresos), color: 'success.main' },
    { label: 'Total retirado', value: formatCurrency(data.totalRetiros), color: 'error.main' },
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
          <Button variant="outlined" color="warning" onClick={() => setRetirarOpen(true)}>💸 Retirar dinero</Button>
        </Box>
      </Box>

      {/* Resumen */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2.5, borderRadius: 2, border: '2px solid', borderColor: 'success.main', height: '100%' }}>
            <Typography variant="subtitle2" color="text.secondary" fontWeight={700}>DINERO A FAVOR</Typography>
            <Typography variant="h4" fontWeight={800} color={data.dineroAFavor >= 0 ? 'success.main' : 'error.main'}>
              {formatCurrency(data.dineroAFavor)}
            </Typography>
            <Typography variant="caption" color="text.secondary">Ingresos por postres − retiros</Typography>
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
