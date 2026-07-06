'use client';

import { useState, useEffect, useRef, useCallback, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Divider from '@mui/material/Divider';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';
import type { StepIconProps } from '@mui/material/StepIcon';
import { useSocket } from '@/hooks/useSocket';
import { useCart } from '@/hooks/useCart';
import { useSnackbar } from '@/app/snackbar-context';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS, orderStatusSteps, TRANSFER_INFO } from '@/lib/constants';
import { isPizzaItemNotes } from '@/lib/pizza';
import { formatCurrency, formatDate, formatOrderPayment } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface Props {
  params: Promise<{ id: string }>;
}

// Ícono de paso con "respiración" en el estado actual: indica al cliente que la
// vista se actualiza sola sin recargar.
function BreathingStepIcon({ active, completed, icon }: StepIconProps) {
  const done = completed;
  return (
    <Box
      sx={{
        width: 30,
        height: 30,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '0.85rem',
        fontWeight: 700,
        color: '#fff',
        bgcolor: done || active ? 'primary.main' : 'grey.400',
        ...(active && {
          animation: 'orderPulse 1.6s ease-in-out infinite',
          '@keyframes orderPulse': {
            '0%, 100%': { opacity: 1, boxShadow: '0 0 0 0 rgba(0,0,0,0)' },
            '50%': { opacity: 0.45, boxShadow: '0 0 0 6px rgba(0,0,0,0.06)' },
          },
        }),
      }}
    >
      {done ? '✓' : icon}
    </Box>
  );
}

export default function OrderDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [paying, setPaying] = useState(false);
  const [editingPayment, setEditingPayment] = useState(false);
  const syncedRef = useRef(false);
  const cartClearedRef = useRef(false);

  const { socket } = useSocket();
  const { clearCart } = useCart();
  const { showError } = useSnackbar();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Al volver de un pago (MercadoPago), vaciamos el carrito de forma confiable
  // (la limpieza previa a la redirección puede no haberse persistido a tiempo).
  useEffect(() => {
    if (cartClearedRef.current) return;
    if (searchParams.get('payment') !== null) {
      cartClearedRef.current = true;
      clearCart();
    }
  }, [searchParams, clearCart]);

  const handlePayNow = async () => {
    setPaying(true);
    try {
      const res = await fetch('/api/payments/create-preference', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: id }),
      });
      const json = await res.json();
      if (res.ok && json.data?.init_point) {
        window.location.href = json.data.init_point;
        return;
      }
      showError(json.error || 'No se pudo iniciar el pago');
    } catch {
      showError('Error de conexión');
    } finally {
      setPaying(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!confirm('¿Cancelar este pedido?')) return;
    setPaying(true);
    try {
      const res = await fetch(`/api/orders/${id}/cancel`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok) { showError(json.error || 'No se pudo cancelar'); return; }
      await loadOrder();
    } catch {
      showError('Error de conexión');
    } finally {
      setPaying(false);
    }
  };

  const changePaymentMethod = async (paymentMethod: 'EFECTIVO' | 'TRANSFERENCIA') => {
    setPaying(true);
    try {
      const res = await fetch(`/api/orders/${id}/payment-method`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethod }),
      });
      const json = await res.json();
      if (!res.ok) { showError(json.error || 'No se pudo cambiar el método de pago'); return; }
      setOrder(json.data);
      setEditingPayment(false);
    } catch {
      showError('Error de conexión');
    } finally {
      setPaying(false);
    }
  };

  const loadOrder = useCallback(async () => {
    const d = await fetch(`/api/orders/${id}`).then((r) => r.json());
    setOrder(d.data);
    return d.data;
  }, [id]);

  useEffect(() => {
    loadOrder().finally(() => setLoading(false));
  }, [loadOrder]);

  // Al volver de Mercado Pago, verificamos el pago real (no depende del webhook).
  useEffect(() => {
    if (!order || syncedRef.current) return;
    const fromMp = searchParams.get('payment') !== null;
    const pendingMp = order.paymentMethod === 'MERCADO_PAGO' && order.payment?.status !== 'APPROVED';
    if (!fromMp && !pendingMp) return;
    syncedRef.current = true;
    setVerifying(true);
    fetch('/api/payments/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: order.id }),
    })
      .then(() => loadOrder())
      .catch(() => {})
      .finally(() => setVerifying(false));
  }, [order, searchParams, loadOrder]);

  useEffect(() => {
    if (!socket || !order) return;
    socket.emit('join:order', order.id);
    const handler = (data: { orderId: string; status: string }) => {
      if (data.orderId === order.id) {
        setOrder((prev: any) => ({ ...prev, status: data.status }));
      }
    };
    socket.on('order:status', handler);
    return () => {
      socket.off('order:status', handler);
    };
  }, [socket, order?.id]);

  if (loading) return <LoadingSpinner message="Cargando pedido..." />;
  if (!order) return (
    <Container maxWidth="md">
      <Alert severity="error">Pedido no encontrado</Alert>
    </Container>
  );

  const steps = orderStatusSteps(order.deliveryType);
  const currentStepIndex = steps.indexOf(order.status);

  // En retiro en local, mientras no esté pagado ni cerrado, el cliente puede
  // alternar entre efectivo y transferencia.
  const canChangePayment =
    order.deliveryType === 'PICKUP' &&
    order.payment?.status !== 'APPROVED' &&
    !['CANCELADO', 'ENTREGADO'].includes(order.status);

  return (
    <Container maxWidth="md">
      <Box sx={{ mb: 3 }}>
        <Button onClick={() => router.push('/orders')} sx={{ mb: 1 }}>
          ← Mis Pedidos
        </Button>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h4" fontWeight={700}>
            Pedido #{order.orderNumber}
          </Typography>
          <Chip
            label={ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] || order.status}
            color={ORDER_STATUS_COLORS[order.status as keyof typeof ORDER_STATUS_COLORS] as any || 'default'}
          />
        </Box>
        <Typography variant="body2" color="text.secondary">{formatDate(order.createdAt)}</Typography>
      </Box>

      {order.status === 'PENDIENTE_PAGO' && !verifying && (
        <Alert
          severity="warning"
          sx={{ mb: 2 }}
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button color="inherit" size="small" variant="outlined" disabled={paying} onClick={handlePayNow}>
                Pagar ahora
              </Button>
              <Button color="inherit" size="small" disabled={paying} onClick={handleCancelOrder}>
                Cancelar
              </Button>
            </Box>
          }
        >
          Tu pedido está <strong>pendiente de pago</strong>. Completá el pago con Mercado Pago para confirmarlo.
        </Alert>
      )}
      {verifying && (
        <Alert severity="info" sx={{ mb: 2 }}>Verificando el pago con Mercado Pago…</Alert>
      )}
      {!verifying && order.paymentMethod === 'MERCADO_PAGO' && order.payment?.status === 'APPROVED' && (
        <Alert severity="success" sx={{ mb: 2 }}>
          ¡Pago confirmado! Tu pedido #{order.orderNumber} quedó registrado.
        </Alert>
      )}
      {!verifying &&
        order.paymentMethod === 'MERCADO_PAGO' &&
        order.payment?.status !== 'APPROVED' &&
        searchParams.get('payment') !== null && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Todavía no pudimos confirmar tu pago. Si ya pagaste, esperá unos segundos y recargá la página.
          </Alert>
        )}

      {/* Status tracker */}
      {order.status !== 'CANCELADO' && (
        <Paper sx={{ p: 3, mb: 3, overflowX: 'hidden' }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>Estado del pedido</Typography>
          <Stepper
            activeStep={currentStepIndex}
            orientation={isMobile ? 'vertical' : 'horizontal'}
            alternativeLabel={!isMobile}
          >
            {steps.map((step) => (
              <Step key={step}>
                <StepLabel StepIconComponent={BreathingStepIcon}>
                  {ORDER_STATUS_LABELS[step as keyof typeof ORDER_STATUS_LABELS]}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Paper>
      )}

      {order.status === 'CANCELADO' && (
        <Alert severity="error" sx={{ mb: 3 }}>Este pedido fue cancelado</Alert>
      )}

      {/* Order items */}
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
                <Typography fontWeight={600}>{formatCurrency(item.unitPrice * item.quantity)}</Typography>
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
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
            <Typography variant="h6" fontWeight={700}>Total</Typography>
            <Typography variant="h6" fontWeight={700} color="primary">{formatCurrency(order.total)}</Typography>
          </Box>
        </Box>
      </Paper>

      {/* Delivery info */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>Datos del pedido</Typography>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
          <Box>
            <Typography variant="body2" color="text.secondary">Tipo</Typography>
            <Typography>{order.deliveryType === 'DELIVERY' ? '🛵 Delivery' : '🏪 Retiro en local'}</Typography>
          </Box>
          <Box sx={{ gridColumn: canChangePayment ? 'span 2' : 'auto' }}>
            <Typography variant="body2" color="text.secondary">Pago</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
              <Typography>{formatOrderPayment(order)}</Typography>
              {canChangePayment && !editingPayment && (
                <Button size="small" onClick={() => setEditingPayment(true)}>
                  Cambiar
                </Button>
              )}
            </Box>

            {canChangePayment && editingPayment && (
              <Box sx={{ mt: 1 }}>
                <RadioGroup
                  value={order.paymentMethod === 'TRANSFERENCIA' ? 'TRANSFERENCIA' : 'EFECTIVO'}
                  onChange={(e) => changePaymentMethod(e.target.value as 'EFECTIVO' | 'TRANSFERENCIA')}
                >
                  <FormControlLabel value="EFECTIVO" control={<Radio />} label="💵 Efectivo al retirar" disabled={paying} />
                  <FormControlLabel value="TRANSFERENCIA" control={<Radio />} label="🏦 Transferencia" disabled={paying} />
                </RadioGroup>
                <Button size="small" onClick={() => setEditingPayment(false)} disabled={paying}>
                  Cerrar
                </Button>
              </Box>
            )}

            {order.paymentMethod === 'TRANSFERENCIA' && order.payment?.status !== 'APPROVED' && (
              <Alert severity="info" sx={{ mt: 1 }}>
                <Typography variant="body2">Alias: <strong>{TRANSFER_INFO.alias}</strong></Typography>
                {TRANSFER_INFO.cbu && <Typography variant="body2">CBU: <strong>{TRANSFER_INFO.cbu}</strong></Typography>}
                <Typography variant="body2">Titular: {TRANSFER_INFO.holder}</Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>
                  Enviá el comprobante por WhatsApp al{' '}
                  <a href={TRANSFER_INFO.whatsappLink} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, color: 'inherit' }}>
                    {TRANSFER_INFO.whatsapp}
                  </a>
                </Typography>
              </Alert>
            )}
          </Box>
          {order.address && (
            <Box sx={{ gridColumn: 'span 2' }}>
              <Typography variant="body2" color="text.secondary">Dirección</Typography>
              <Typography>
                {order.address.street} {order.address.number}
                {order.address.apartment ? `, ${order.address.apartment}` : ''}, {order.address.city}
              </Typography>
            </Box>
          )}
          {order.notes && (
            <Box sx={{ gridColumn: 'span 2' }}>
              <Typography variant="body2" color="text.secondary">Observaciones</Typography>
              <Typography>{order.notes}</Typography>
            </Box>
          )}
        </Box>
      </Paper>
    </Container>
  );
}
