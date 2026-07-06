'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import Grid from '@mui/material/Grid';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, NEXT_STATUSES } from '@/lib/constants';
import { isPizzaItemNotes } from '@/lib/pizza';
import { PaymentDialog, type PaymentKind } from '@/components/admin/PaymentDialog';
import { formatCurrency, formatDate, formatOrderPayment } from '@/lib/utils';
import { DeliveryMapQR } from '@/components/orders/DeliveryMapQR';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useSnackbar } from '@/app/snackbar-context';

interface Props {
  params: Promise<{ id: string }>;
}

export default function AdminOrderDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const { showSuccess, showError } = useSnackbar();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState('');

  useEffect(() => {
    fetch(`/api/admin/orders/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setOrder(d.data);
        setNewStatus(d.data?.status || '');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleUpdateStatus = async () => {
    if (!newStatus || newStatus === order.status) return;
    // Al confirmar, el servidor avisa a la estación de impresión (QZ Tray) para
    // imprimir cocina + comanda. El botón "Imprimir ticket" sirve de respaldo.
    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) {
        showError(json.error || 'Error al actualizar estado');
        return;
      }
      setOrder((prev: any) => ({ ...prev, status: newStatus }));
      showSuccess('Estado actualizado');
    } catch {
      showError('Error de conexión');
    } finally {
      setUpdating(false);
    }
  };

  const [payOpen, setPayOpen] = useState(false);

  const submitPayment = async (data: { method: PaymentKind; cashAmount?: number; transferAmount?: number }) => {
    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}/pay`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok) { showError(json.error || 'Error al registrar el cobro'); return; }
      setOrder(json.data);
      setPayOpen(false);
      showSuccess('Cobro registrado');
    } catch {
      showError('Error de conexión');
    } finally {
      setUpdating(false);
    }
  };

  const handleVerifyMpPayment = async () => {
    setUpdating(true);
    try {
      const res = await fetch('/api/payments/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id }),
      });
      const json = await res.json();
      if (!res.ok) { showError(json.error || 'No se pudo verificar el pago'); return; }
      const fresh = await fetch(`/api/admin/orders/${id}`).then((r) => r.json());
      setOrder(fresh.data);
      showSuccess(
        json.data?.status === 'APPROVED' ? 'Pago confirmado ✓' : 'El pago aún no está acreditado'
      );
    } catch {
      showError('Error de conexión');
    } finally {
      setUpdating(false);
    }
  };

  // Reenvía a la estación de impresión (QZ Tray), igual que la impresión al
  // confirmar. Requiere la pantalla "Estación de impresión" abierta y activa.
  const handlePrint = async () => {
    try {
      const res = await fetch(`/api/admin/orders/${id}/print`, { method: 'POST' });
      if (!res.ok) { showError('No se pudo reenviar a imprimir'); return; }
      showSuccess('Enviado a la estación de impresión');
    } catch {
      showError('Error de conexión');
    }
  };

  if (loading) return <LoadingSpinner message="Cargando pedido..." />;
  if (!order) return (
    <Box>
      <Alert severity="error">Pedido no encontrado</Alert>
    </Box>
  );

  const nextOptions = NEXT_STATUSES[order.status as keyof typeof NEXT_STATUSES] || [];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button onClick={() => router.push('/admin/orders')}>← Volver</Button>
        <Typography variant="h4" fontWeight={700} sx={{ flex: 1 }}>
          Pedido #{order.orderNumber}
        </Typography>
        <Chip
          label={ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS]}
          color={ORDER_STATUS_COLORS[order.status as keyof typeof ORDER_STATUS_COLORS] as any}
        />
        <Button variant="outlined" onClick={handlePrint}>🖨️ Reimprimir</Button>
      </Box>

      <Grid container spacing={3}>
        {/* Main info */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>Productos</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {order.items?.map((item: any) => {
                const isPizza = isPizzaItemNotes(item.notes);
                const title = isPizza ? item.notes : item.product?.name || item.promotion?.name;
                return (
                  <Box key={item.id} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography fontWeight={500}>{item.quantity}x {title}</Typography>
                      {!isPizza && item.notes && (
                        <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
                          {item.notes}
                        </Typography>
                      )}
                    </Box>
                    <Typography fontWeight={600}>
                      {formatCurrency(item.unitPrice * item.quantity)}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography color="text.secondary">Subtotal</Typography>
                <Typography>{formatCurrency(order.subtotal)}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography color="text.secondary">Envío</Typography>
                <Typography>{order.deliveryFee > 0 ? formatCurrency(order.deliveryFee) : 'Gratis'}</Typography>
              </Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                <Typography variant="h6" fontWeight={700}>Total</Typography>
                <Typography variant="h6" fontWeight={700} color="primary">
                  {formatCurrency(order.total)}
                </Typography>
              </Box>
            </Box>
          </Paper>

          {order.notes && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>Observaciones</Typography>
              <Typography>{order.notes}</Typography>
            </Paper>
          )}
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          {/* Status update */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>Cambiar estado</Typography>
            {nextOptions.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Nuevo estado</InputLabel>
                  <Select value={newStatus} label="Nuevo estado" onChange={(e) => setNewStatus(e.target.value)}>
                    {nextOptions.map((s) => (
                      <MenuItem key={s} value={s}>
                        {ORDER_STATUS_LABELS[s as keyof typeof ORDER_STATUS_LABELS]}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <Button
                  variant="contained"
                  fullWidth
                  onClick={handleUpdateStatus}
                  disabled={updating || newStatus === order.status}
                >
                  {updating ? 'Actualizando...' : 'Actualizar'}
                </Button>
              </Box>
            ) : (
              <Typography color="text.secondary">No hay estados disponibles</Typography>
            )}
          </Paper>

          {/* Customer info */}
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>Cliente</Typography>
            <Typography fontWeight={500}>{order.user?.name}</Typography>
            <Typography color="text.secondary">{order.user?.email}</Typography>
            {order.user?.phone && (
              <Typography color="text.secondary">{order.user.phone}</Typography>
            )}
          </Paper>

          {/* Delivery info */}
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>Entrega</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">Tipo</Typography>
                <Typography>{order.deliveryType === 'DELIVERY' ? '🛵 Delivery' : '🏪 Retiro en local'}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Pago</Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography>{formatOrderPayment(order)}</Typography>
                  <Chip
                    label={order.payment?.status === 'APPROVED' ? 'Pagado' : 'Pago pendiente'}
                    size="small"
                    color={order.payment?.status === 'APPROVED' ? 'success' : 'warning'}
                  />
                </Box>
                {order.payment?.status !== 'APPROVED' && order.status !== 'CANCELADO' && (
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                    <Button
                      variant="outlined"
                      color="success"
                      size="small"
                      onClick={() => setPayOpen(true)}
                      disabled={updating}
                    >
                      💵 Registrar pago
                    </Button>
                    {order.paymentMethod === 'MERCADO_PAGO' && (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={handleVerifyMpPayment}
                        disabled={updating}
                      >
                        🔄 Verificar pago MP
                      </Button>
                    )}
                  </Box>
                )}
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Fecha</Typography>
                <Typography>{formatDate(order.createdAt)}</Typography>
              </Box>
              {order.address && (
                <Box>
                  <Typography variant="body2" color="text.secondary">Dirección</Typography>
                  <Typography>
                    {order.address.street} {order.address.number}
                    {order.address.apartment ? `, ${order.address.apartment}` : ''}
                  </Typography>
                  <Typography>{order.address.city}</Typography>
                  {order.address.reference && (
                    <Typography variant="caption" color="text.secondary">
                      Ref: {order.address.reference}
                    </Typography>
                  )}
                </Box>
              )}
            </Box>

            {order.deliveryType === 'DELIVERY' && order.address && (
              <Box sx={{ mt: 2, pt: 2, borderTop: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                  🛵 Ruta de entrega
                </Typography>
                <DeliveryMapQR address={order.address} caption="Repartidor: escaneá para la ruta" />
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      <PaymentDialog
        open={payOpen}
        total={Number(order.total)}
        initialMethod={order.paymentMethod}
        busy={updating}
        onClose={() => setPayOpen(false)}
        onConfirm={submitPayment}
      />
    </Box>
  );
}
