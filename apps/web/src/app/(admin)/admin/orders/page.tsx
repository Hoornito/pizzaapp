'use client';

import { useState, useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TablePagination from '@mui/material/TablePagination';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import NotificationsOffIcon from '@mui/icons-material/NotificationsOff';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { playNewOrderSound, primeAudio } from '@/lib/sound';
import {
  ORDER_STATUS_LABELS,
  ORDER_STATUS_COLORS,
  NEXT_STATUSES,
  ORDER_PAYMENT_METHOD_LABELS,
  ORDER_PAYMENT_METHOD_EMOJI,
} from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils';
import { isPizzaItemNotes } from '@/lib/pizza';
import { PaymentDialog, type PaymentKind } from '@/components/admin/PaymentDialog';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useSnackbar } from '@/app/snackbar-context';

const ACTIVE_STATUSES = ['RECIBIDO', 'CONFIRMADO', 'LISTO', 'EN_REPARTO'];

function localToday(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().split('T')[0];
}

/** Botón principal de avance según el estado actual. */
function primaryNext(order: any): { status: string; label: string } | null {
  switch (order.status) {
    case 'RECIBIDO': return { status: 'CONFIRMADO', label: 'Confirmar pedido' };
    // CONFIRMADO y los estados intermedios legacy avanzan a LISTO.
    case 'CONFIRMADO':
    case 'PREPARANDO':
    case 'EN_HORNO':
      return { status: 'LISTO', label: 'Marcar listo' };
    case 'LISTO':
      return order.deliveryType === 'DELIVERY'
        ? { status: 'EN_REPARTO', label: 'Enviar a reparto' }
        : { status: 'ENTREGADO', label: 'Marcar entregado' };
    case 'EN_REPARTO': return { status: 'ENTREGADO', label: 'Marcar entregado' };
    default: return null;
  }
}

export default function AdminOrdersPage() {
  const router = useRouter();
  const { socket } = useSocket();
  const { showSuccess, showError } = useSnackbar();
  const [tab, setTab] = useState<'active' | 'delivered'>('active');
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [date, setDate] = useState(localToday);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(12);
  const [total, setTotal] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [soundOn, setSoundOn] = useState(true);
  const soundOnRef = useRef(true);

  // Preferencia de sonido (persistida) + desbloqueo del audio en el primer gesto.
  useEffect(() => {
    const saved = localStorage.getItem('admin:orderSound');
    if (saved !== null) {
      const on = saved === '1';
      setSoundOn(on);
      soundOnRef.current = on;
    }
    const unlock = () => primeAudio();
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  const toggleSound = () => {
    setSoundOn((prev) => {
      const next = !prev;
      soundOnRef.current = next;
      localStorage.setItem('admin:orderSound', next ? '1' : '0');
      if (next) playNewOrderSound(); // confirmación audible al activar
      return next;
    });
  };

  useEffect(() => {
    fetch('/api/admin/employees?role=REPARTIDOR')
      .then((r) => r.json())
      .then((d) => setDrivers(d.data || []))
      .catch(() => {});
  }, []);

  const loadOrders = () => {
    const params = new URLSearchParams({ page: String(page + 1), limit: String(rowsPerPage) });
    if (tab === 'active') {
      if (statusFilter) params.set('status', statusFilter);
      else params.set('view', 'active');
    } else {
      params.set('status', 'ENTREGADO');
      params.set('date', date);
    }
    fetch(`/api/admin/orders?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setOrders(d.data || []);
        setTotal(d.pagination?.total || 0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { setLoading(true); loadOrders(); }, [tab, page, rowsPerPage, statusFilter, date]);

  useEffect(() => {
    if (!socket) return;
    socket.emit('join:admin');
    const onNew = () => {
      if (soundOnRef.current) playNewOrderSound();
      loadOrders();
    };
    socket.on('order:new', onNew);
    socket.on('order:status_updated', loadOrders);
    return () => {
      socket.off('order:new', onNew);
      socket.off('order:status_updated', loadOrders);
    };
  }, [socket, tab, page, rowsPerPage, statusFilter, date]);

  const changeStatus = async (id: string, status: string, okMsg: string): Promise<boolean> => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) { showError(json.error || 'Error al actualizar'); return false; }
      showSuccess(okMsg);
      loadOrders();
      return true;
    } catch {
      showError('Error de conexión');
      return false;
    } finally {
      setBusyId(null);
    }
  };

  // Avanzar el pedido. Al confirmarlo, el servidor avisa a la estación de
  // impresión (QZ Tray) para imprimir cocina + comanda en sus impresoras. Si no
  // hay estación, se puede usar el botón manual "Imprimir".
  const advanceOrder = (order: any, next: { status: string; label: string }) => {
    changeStatus(order.id, next.status, `${next.label} ✓`);
  };

  // Reenvía el pedido a la estación de impresión (QZ Tray). Requiere tener la
  // pantalla "Estación de impresión" abierta y activa en la PC de las impresoras.
  const reprint = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/orders/${id}/print`, { method: 'POST' });
      if (!res.ok) { showError('No se pudo reenviar a imprimir'); return; }
      showSuccess('Enviado a la estación de impresión');
    } catch {
      showError('Error de conexión');
    }
  };

  // Cobro: abre el diálogo para indicar/corregir el tipo de ingreso.
  const [payTarget, setPayTarget] = useState<{ orderId: string; total: number; method?: string } | null>(null);

  const openPay = (order: any) =>
    setPayTarget({ orderId: order.id, total: Number(order.total), method: order.paymentMethod });

  const submitPayment = async (data: { method: PaymentKind; cashAmount?: number; transferAmount?: number }) => {
    if (!payTarget) return;
    setBusyId(payTarget.orderId);
    try {
      const res = await fetch(`/api/admin/orders/${payTarget.orderId}/pay`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) { showError(json.error || 'Error al registrar el cobro'); return; }
      showSuccess('Cobro registrado');
      setPayTarget(null);
      loadOrders();
    } catch {
      showError('Error de conexión');
    } finally {
      setBusyId(null);
    }
  };

  const cancelOrder = (id: string) => {
    if (!confirm('¿Cancelar este pedido?')) return;
    changeStatus(id, 'CANCELADO', 'Pedido cancelado');
  };

  const assignDriver = async (orderId: string, employeeId: string) => {
    if (!employeeId) return;
    setBusyId(orderId);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/assign-delivery`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ employeeId }),
      });
      const json = await res.json();
      if (!res.ok) { showError(json.error || 'Error al asignar repartidor'); return; }
      showSuccess('Repartidor asignado');
      loadOrders();
    } catch {
      showError('Error de conexión');
    } finally {
      setBusyId(null);
    }
  };

  // Valor de la pestaña: 'active' (todos los activos), un estado puntual, o 'delivered'.
  const tabValue = tab === 'delivered' ? 'delivered' : statusFilter || 'active';

  const handleTabChange = (v: string) => {
    setPage(0);
    if (v === 'delivered') {
      setTab('delivered');
      setStatusFilter('');
    } else if (v === 'active') {
      setTab('active');
      setStatusFilter('');
    } else {
      // pestaña de un estado puntual
      setTab('active');
      setStatusFilter(v);
    }
  };

  const deliveredTotal = orders.reduce((s, o) => s + Number(o.total), 0);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
        <Typography variant="h4" fontWeight={700}>Pedidos</Typography>
        <Tooltip title={soundOn ? 'Sonido de nuevos pedidos: activado' : 'Sonido de nuevos pedidos: silenciado'}>
          <IconButton onClick={toggleSound} color={soundOn ? 'primary' : 'default'}>
            {soundOn ? <NotificationsActiveIcon /> : <NotificationsOffIcon />}
          </IconButton>
        </Tooltip>
      </Box>

      <Tabs
        value={tabValue}
        onChange={(_, v) => handleTabChange(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 3 }}
      >
        <Tab value="active" label="Activos" />
        {ACTIVE_STATUSES.map((s) => (
          <Tab key={s} value={s} label={ORDER_STATUS_LABELS[s]} />
        ))}
        <Tab value="delivered" label="Entregados (día)" />
      </Tabs>

      {/* Filtros según pestaña */}
      <Box sx={{ mb: 3 }}>
        {tabValue === 'active' ? (
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Estado</InputLabel>
            <Select
              value={statusFilter}
              label="Estado"
              onChange={(e) => { setStatusFilter(e.target.value); setPage(0); }}
            >
              <MenuItem value="">Todos los activos</MenuItem>
              {ACTIVE_STATUSES.map((s) => (
                <MenuItem key={s} value={s}>{ORDER_STATUS_LABELS[s]}</MenuItem>
              ))}
            </Select>
          </FormControl>
        ) : tab === 'delivered' ? (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
            <TextField
              type="date"
              size="small"
              label="Día"
              value={date}
              onChange={(e) => { setDate(e.target.value); setPage(0); }}
              InputLabelProps={{ shrink: true }}
            />
            <Typography color="text.secondary">
              {total} entregado{total === 1 ? '' : 's'} · {formatCurrency(deliveredTotal)} (página actual)
            </Typography>
          </Box>
        ) : null}
      </Box>

      {loading ? (
        <LoadingSpinner message="Cargando pedidos..." />
      ) : orders.length === 0 ? (
        <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
          {tab === 'active' ? 'No hay pedidos activos' : 'No hay pedidos entregados este día'}
        </Typography>
      ) : tab === 'active' ? (
        <Grid container spacing={2}>
          {orders.map((order) => {
            const paid = order.payment?.status === 'APPROVED';
            const next = primaryNext(order);
            const canCancel = (NEXT_STATUSES[order.status] || []).includes('CANCELADO');
            const busy = busyId === order.id;
            // No se puede enviar a reparto sin un repartidor asignado.
            const needsDriver = next?.status === 'EN_REPARTO' && !order.deliveryEmployee;
            return (
              <Grid item xs={12} sm={6} md={4} key={order.id}>
                <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="h6" fontWeight={700}>#{order.orderNumber}</Typography>
                      <Chip
                        label={ORDER_STATUS_LABELS[order.status]}
                        color={ORDER_STATUS_COLORS[order.status] as any}
                        size="small"
                      />
                    </Box>

                    <Typography variant="body2" color="text.secondary">{formatDate(order.createdAt)}</Typography>
                    <Typography variant="body2" fontWeight={500}>
                      {order.user?.name || order.user?.email || 'Cliente'}
                      {order.phone ? ` · ${order.phone}` : ''}
                    </Typography>

                    <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
                      <Chip label={order.deliveryType === 'DELIVERY' ? '🛵 Delivery' : '🏪 Retiro'} size="small" variant="outlined" />
                      <Chip label={`${ORDER_PAYMENT_METHOD_EMOJI[order.paymentMethod] || ''} ${ORDER_PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod}`} size="small" variant="outlined" />
                      <Chip label={paid ? 'Pagado' : 'Pago pendiente'} size="small" color={paid ? 'success' : 'warning'} />
                    </Box>

                    <Divider sx={{ my: 1.5 }} />

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                      {order.items?.slice(0, 5).map((item: any) => {
                        const isPizza = isPizzaItemNotes(item.notes);
                        const title = isPizza ? item.notes : item.product?.name || item.promotion?.name;
                        return (
                          <Box key={item.id}>
                            <Typography variant="body2">{item.quantity}x {title}</Typography>
                            {!isPizza && item.notes && (
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ display: 'block', whiteSpace: 'pre-line', pl: 1.5 }}
                              >
                                {item.notes}
                              </Typography>
                            )}
                          </Box>
                        );
                      })}
                      {order.items?.length > 5 && (
                        <Typography variant="caption" color="text.secondary">+{order.items.length - 5} más…</Typography>
                      )}
                    </Box>

                    {order.deliveryType === 'DELIVERY' && order.address && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 1 }}>
                        📍 {order.address.street} {order.address.number}
                        {order.address.apartment ? `, ${order.address.apartment}` : ''} · {order.address.city}
                      </Typography>
                    )}

                    {order.deliveryType === 'DELIVERY' && (
                      <FormControl size="small" fullWidth sx={{ mt: 1 }}>
                        <InputLabel>🛵 Repartidor</InputLabel>
                        <Select
                          label="🛵 Repartidor"
                          value={order.deliveryEmployee?.id || ''}
                          disabled={busy || drivers.length === 0}
                          onChange={(e) => assignDriver(order.id, e.target.value)}
                        >
                          {drivers.length === 0 && (
                            <MenuItem value="" disabled>
                              No hay repartidores (cargá empleados con rol Repartidor)
                            </MenuItem>
                          )}
                          {drivers.map((d) => (
                            <MenuItem key={d.id} value={d.id}>
                              {d.firstName} {d.lastName}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    )}
                    {order.notes && (
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5, fontStyle: 'italic' }}>
                        📝 {order.notes}
                      </Typography>
                    )}

                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5 }}>
                      <Typography color="text.secondary">Total</Typography>
                      <Typography variant="h6" fontWeight={700}>{formatCurrency(order.total)}</Typography>
                    </Box>
                  </CardContent>

                  <CardActions sx={{ flexWrap: 'wrap', gap: 1, px: 2, pb: 2 }}>
                    {next && (
                      <Box sx={{ width: needsDriver ? '100%' : 'auto' }}>
                        <Button variant="contained" size="small" disabled={busy || needsDriver}
                          onClick={() => advanceOrder(order, next)}>
                          {next.label}
                        </Button>
                        {needsDriver && (
                          <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                            Asigná un repartidor antes de enviar a reparto
                          </Typography>
                        )}
                      </Box>
                    )}
                    {!paid && (
                      <Button variant="outlined" color="success" size="small" disabled={busy} onClick={() => openPay(order)}>
                        💵 Pagó
                      </Button>
                    )}
                    <Button size="small" onClick={() => router.push(`/admin/orders/${order.id}`)}>Ver</Button>
                    <Button size="small" disabled={busy} onClick={() => reprint(order.id)}>
                      🖨️ Reimprimir
                    </Button>
                    {canCancel && (
                      <Button size="small" color="error" disabled={busy} onClick={() => cancelOrder(order.id)}>Cancelar</Button>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.100' }}>
                <TableCell><strong>Pedido</strong></TableCell>
                <TableCell><strong>Hora</strong></TableCell>
                <TableCell><strong>Cliente</strong></TableCell>
                <TableCell align="center"><strong>Tipo</strong></TableCell>
                <TableCell><strong>Pago</strong></TableCell>
                <TableCell align="right"><strong>Total</strong></TableCell>
                <TableCell></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order.id} hover>
                  <TableCell><Typography fontWeight={600}>#{order.orderNumber}</Typography></TableCell>
                  <TableCell>{formatDate(order.createdAt)}</TableCell>
                  <TableCell>{order.user?.name || order.user?.email || 'Cliente'}</TableCell>
                  <TableCell align="center">{order.deliveryType === 'DELIVERY' ? '🛵' : '🏪'}</TableCell>
                  <TableCell>
                    {ORDER_PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod}{' '}
                    <Chip
                      label={order.payment?.status === 'APPROVED' ? 'Pagado' : 'Pend.'}
                      size="small"
                      color={order.payment?.status === 'APPROVED' ? 'success' : 'warning'}
                    />
                  </TableCell>
                  <TableCell align="right"><Typography fontWeight={600}>{formatCurrency(order.total)}</Typography></TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'flex-end' }}>
                      <Button size="small" onClick={() => router.push(`/admin/orders/${order.id}`)}>Ver</Button>
                      {order.payment?.status !== 'APPROVED' && (
                        <Button size="small" color="success" onClick={() => openPay(order)}>💵 Pagó</Button>
                      )}
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <TablePagination
        component="div"
        count={total}
        page={page}
        onPageChange={(_, p) => setPage(p)}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={(e) => { setRowsPerPage(Number(e.target.value)); setPage(0); }}
        rowsPerPageOptions={tab === 'active' ? [12, 24, 48] : [20, 50, 100]}
        labelRowsPerPage="Por página:"
      />

      <PaymentDialog
        open={!!payTarget}
        total={payTarget?.total || 0}
        initialMethod={payTarget?.method}
        busy={!!payTarget && busyId === payTarget.orderId}
        onClose={() => setPayTarget(null)}
        onConfirm={submitPayment}
      />
    </Box>
  );
}
