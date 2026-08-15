'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import { useCart } from '@/hooks/useCart';
import { CartSummary } from '@/components/cart/CartSummary';
import { CartItem } from '@/components/cart/CartItem';
import { formatCurrency } from '@/lib/utils';
import { TRANSFER_INFO, isCityInDeliveryZone, DELIVERY_ZONE_LABEL } from '@/lib/constants';
import { CopyButton } from '@/components/ui/CopyButton';
import { pointInPolygon, DELIVERY_ZONE_POLYGON } from '@/lib/geo';
import dynamic from 'next/dynamic';

// El mapa usa Leaflet (window) -> solo en el cliente.
const DeliveryZoneMap = dynamic(
  () => import('@/components/products/DeliveryZoneMap').then((m) => m.DeliveryZoneMap),
  { ssr: false, loading: () => <Box sx={{ height: 220, borderRadius: 2, bgcolor: 'grey.100' }} /> }
);
import { useSnackbar } from '@/app/snackbar-context';

const STEPS = ['Tu pedido', 'Datos de entrega', 'Pago'];

interface TimeSlot {
  value: string;
  from: string;
  to: string;
}

interface CheckoutForm {
  deliveryType: 'DELIVERY' | 'PICKUP';
  paymentMethod: 'MERCADO_PAGO' | 'EFECTIVO' | 'MIXTO' | 'TRANSFERENCIA' | 'A_DEFINIR';
  cashAmount: string;
  transferAmount: string;
  street: string;
  number: string;
  apartment: string;
  city: string;
  state: string;
  reference: string;
  phone: string;
  notes: string;
  tip: string;
}

export default function CheckoutPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const { items, subtotal, deliveryFee, total, clearCart, setDeliveryFee } = useCart();
  const { showError, showSuccess } = useSnackbar();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  // Cuándo lo quiere: ya mismo o programado para una franja de hoy.
  const [when, setWhen] = useState<'asap' | 'scheduled'>('asap');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slot, setSlot] = useState('');
  const [form, setForm] = useState<CheckoutForm>({
    deliveryType: 'DELIVERY',
    paymentMethod: 'EFECTIVO',
    cashAmount: '',
    transferAmount: '',
    street: '',
    number: '',
    apartment: '',
    city: '',
    state: '',
    reference: '',
    phone: session?.user.phone || '',
    notes: '',
    tip: '',
  });

  // Descuento general de la app. Lo recalcula el servidor al crear el pedido:
  // acá es para mostrarlo y para que el reparto del pago mixto cuadre.
  const [promo, setPromo] = useState<{ percentage: number; label: string } | null>(null);

  // Propina para el repartidor (solo delivery). Se suma al total a pagar.
  const tipNum = form.deliveryType === 'DELIVERY' ? Math.max(parseFloat(form.tip) || 0, 0) : 0;
  const discountNum = promo ? Math.round(subtotal * (promo.percentage / 100) * 100) / 100 : 0;
  const payTotal = Math.max(0, Math.round((total + tipNum - discountNum) * 100) / 100);

  // Evita que, al vaciar el carrito tras crear el pedido, este efecto compita
  // con la navegación a la pantalla del pedido (o a MercadoPago).
  const placingOrderRef = useRef(false);

  useEffect(() => {
    if (items.length === 0 && !placingOrderRef.current) router.push('/menu');
  }, [items.length, router]);

  useEffect(() => {
    setDeliveryFee(0); // El envío es sin cargo.
  }, [form.deliveryType]);

  useEffect(() => {
    fetch('/api/settings/discount', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setPromo(d.data ?? null))
      .catch(() => setPromo(null));
  }, []);

  // El teléfono de la cuenta se completa solo. No alcanza con el valor inicial
  // del form: en el primer render la sesión todavía puede estar cargando.
  useEffect(() => {
    const suyo = session?.user.phone;
    if (suyo) setForm((prev) => (prev.phone ? prev : { ...prev, phone: suyo }));
  }, [session?.user.phone]);

  // Franjas para programar. Las calcula el servidor (horarios del local + margen
  // mínimo), así no dependen del reloj del dispositivo.
  useEffect(() => {
    fetch('/api/schedule/slots', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setSlots(d.data || []))
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, []);

  // Si la franja elegida dejó de estar disponible (pasó el tiempo), la soltamos.
  useEffect(() => {
    if (slot && !slots.some((s) => s.value === slot)) setSlot('');
  }, [slots, slot]);

  // Al elegir pago Mixto, pre-cargar todo como efectivo para que el reparto
  // siempre arranque sumando el total.
  useEffect(() => {
    if (form.paymentMethod === 'MIXTO' && !form.cashAmount && !form.transferAmount) {
      setForm((prev) => ({ ...prev, cashAmount: String(payTotal), transferAmount: '0' }));
    }
  }, [form.paymentMethod, payTotal]);

  const handleChange = (field: keyof CheckoutForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // El reparto Mixto es complementario: lo que falta para el total va al otro medio.
  const handleSplitChange = (field: 'cashAmount' | 'transferAmount', value: string) => {
    const raw = parseFloat(value);
    const amount = Math.min(Math.max(Number.isNaN(raw) ? 0 : raw, 0), payTotal);
    const other = Math.round((payTotal - amount) * 100) / 100;
    setForm((prev) => ({
      ...prev,
      [field]: value === '' ? '' : String(amount),
      [field === 'cashAmount' ? 'transferAmount' : 'cashAmount']: String(other),
    }));
  };

  // Geocodifica la dirección y verifica que caiga dentro de la zona de reparto.
  // Manda el POLÍGONO (el alcance real), no el texto: vale si el punto está
  // dentro del polígono O si OSM lo ubica en San Vicente. Así una dirección justo
  // en el borde (aunque no diga "San Vicente") igual entra si está en el área.
  // Solo bloqueamos cuando la geocodificación funciona y da claramente afuera;
  // si el geocoder no responde, NO limitamos (dejamos pasar).
  const checkDeliveryZone = async (): Promise<boolean> => {
    const q = [`${form.street} ${form.number}`, form.city, form.state || 'Buenos Aires', 'Argentina']
      .filter(Boolean)
      .join(', ');
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (json.result) {
        const inPolygon = pointInPolygon({ lat: json.result.lat, lng: json.result.lng }, DELIVERY_ZONE_POLYGON);
        const inArea = ((json.result.areas as string[] | undefined) ?? []).some((a) => isCityInDeliveryZone(a));
        return inPolygon || inArea;
      }
    } catch {
      // sin respuesta del geocoder
    }
    return true; // no pudimos geocodificar -> no bloqueamos al cliente
  };

  const handleSubmitOrder = async () => {
    if (!session) {
      router.push('/login?callbackUrl=/checkout');
      return;
    }

    if (form.deliveryType === 'DELIVERY' && (!form.street || !form.number || !form.city)) {
      showError('Completá la dirección de entrega');
      return;
    }

    // Sin teléfono no se puede coordinar la entrega.
    if (form.phone.trim().length < 6) {
      showError('Poné un teléfono de contacto para poder coordinar tu pedido');
      return;
    }

    const cashAmount = parseFloat(form.cashAmount) || 0;
    const transferAmount = parseFloat(form.transferAmount) || 0;
    if (form.paymentMethod === 'MIXTO' && Math.abs(cashAmount + transferAmount - payTotal) >= 0.01) {
      showError('El efectivo y la transferencia deben sumar el total');
      return;
    }

    // Geocercado real: geocodificamos la dirección y verificamos que caiga en la
    // zona de reparto (polígono de San Vicente + municipio que devuelve OSM).
    if (form.deliveryType === 'DELIVERY') {
      setLoading(true);
      const inZone = await checkDeliveryZone();
      if (!inZone) {
        setLoading(false);
        showError(`La dirección está fuera de nuestra zona de reparto (${DELIVERY_ZONE_LABEL}). Podés elegir "Retiro en local".`);
        return;
      }
    }

    setLoading(true);
    try {
      const orderData = {
        deliveryType: form.deliveryType,
        paymentMethod: form.paymentMethod,
        subtotal,
        deliveryFee,
        tip: tipNum,
        discount: discountNum,
        total: payTotal,
        ...(form.paymentMethod === 'MIXTO' ? { cashAmount, transferAmount } : {}),
        ...(form.deliveryType === 'DELIVERY'
          ? {
              address: {
                street: form.street,
                number: form.number,
                apartment: form.apartment || undefined,
                city: form.city,
                state: form.state || undefined,
                reference: form.reference || undefined,
              },
            }
          : {}),
        notes: form.notes,
        phone: form.phone,
        addressId: undefined,
        ...(when === 'scheduled' && slot ? { scheduledFor: slot } : {}),
        items: items.map((item) => ({
          productId: item.productId,
          promotionId: item.promotionId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          notes: item.notes,
          promoChoices: item.promoChoices,
        })),
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderData),
      });

      const json = await res.json();
      if (!res.ok) {
        showError(json.error || 'Error al crear el pedido');
        return;
      }

      const order = json.data;
      // Pedido creado: a partir de acá vamos a vaciar el carrito y navegar; que
      // el efecto de "carrito vacío" no nos mande a /menu.
      placingOrderRef.current = true;

      if (form.paymentMethod === 'MERCADO_PAGO') {
        // Checkout Pro: creamos la preferencia y redirigimos a MercadoPago, donde
        // el comprador paga con tarjeta o dinero en cuenta.
        const prefRes = await fetch('/api/payments/create-preference', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: order.id }),
        });
        const prefJson = await prefRes.json();
        if (prefRes.ok && prefJson.data?.init_point) {
          clearCart();
          window.location.href = prefJson.data.init_point;
          return;
        }
        showError(prefJson.error || 'No se pudo iniciar el pago con MercadoPago');
        return;
      }

      clearCart();
      showSuccess('¡Pedido realizado con éxito!');
      router.push(`/orders/${order.id}`);
    } catch {
      showError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) return null;

  const transferInfoAlert = (
    <Alert severity="info" sx={{ mb: 3 }}>
      <Typography variant="body2" fontWeight={700} gutterBottom>
        Datos para la transferencia:
      </Typography>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="body2">Alias: <strong>{TRANSFER_INFO.alias}</strong></Typography>
        <CopyButton text={TRANSFER_INFO.alias} label="Copiar alias" />
      </Box>
      {TRANSFER_INFO.cbu && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mt: 0.5 }}>
          <Typography variant="body2">CBU: <strong>{TRANSFER_INFO.cbu}</strong></Typography>
          <CopyButton text={TRANSFER_INFO.cbu} label="Copiar CBU" />
        </Box>
      )}
      <Typography variant="body2">Titular: {TRANSFER_INFO.holder}</Typography>
      <Typography variant="body2" sx={{ mt: 1 }}>
        Enviá el comprobante por WhatsApp al{' '}
        <a href={TRANSFER_INFO.whatsappLink} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, color: 'inherit' }}>
          {TRANSFER_INFO.whatsapp}
        </a>
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        El pedido queda como “pago pendiente” hasta que el negocio confirme la transferencia.
      </Typography>
    </Alert>
  );

  return (
    <Container maxWidth="lg">
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Confirmar Pedido
      </Typography>

      <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', md: 'row' } }}>
        {/* Main content */}
        <Box sx={{ flex: 2 }}>
          {activeStep === 0 && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>Tu pedido</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                {items.map((item) => <CartItem key={item.id} item={item} />)}
              </Box>
              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="contained" onClick={() => setActiveStep(1)}>
                  Continuar
                </Button>
              </Box>
            </Paper>
          )}

          {activeStep === 1 && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>Datos de entrega</Typography>

              {/* Selector tipo "píldora": el elegido queda relleno, como en las
                  apps de delivery. Más claro en mobile que dos radios. */}
              <Box
                sx={{
                  display: 'flex', gap: 0.5, p: 0.5, mb: 3,
                  bgcolor: 'grey.100', borderRadius: 999,
                }}
              >
                {([
                  { value: 'DELIVERY', label: 'Delivery' },
                  { value: 'PICKUP', label: 'Retiro en el local' },
                ] as const).map((opt) => {
                  const selected = form.deliveryType === opt.value;
                  return (
                    <Button
                      key={opt.value}
                      onClick={() => handleChange('deliveryType', opt.value)}
                      disableElevation
                      sx={{
                        flex: 1, borderRadius: 999, py: 1.1, textTransform: 'none',
                        fontWeight: selected ? 700 : 500,
                        fontSize: { xs: '0.85rem', sm: '0.95rem' },
                        bgcolor: selected ? 'grey.900' : 'transparent',
                        color: selected ? 'common.white' : 'text.secondary',
                        '&:hover': { bgcolor: selected ? 'grey.900' : 'grey.200' },
                      }}
                    >
                      {opt.label}
                    </Button>
                  );
                })}
              </Box>

              {/* Cuándo lo querés: dos tarjetas seleccionables, no radios sueltos. */}
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2 }}>
                {([
                  {
                    value: 'asap' as const,
                    icon: '🛵',
                    title: 'Lo antes posible',
                    sub: 'El local te confirma el tiempo estimado al tomar el pedido',
                    disabled: false,
                  },
                  {
                    value: 'scheduled' as const,
                    icon: '🕒',
                    title: 'Programar para después',
                    sub: slotsLoading
                      ? 'Buscando horarios…'
                      : slots.length === 0
                        ? 'No hay horarios disponibles para hoy'
                        : 'Elegí una franja de hoy',
                    disabled: !slotsLoading && slots.length === 0,
                  },
                ]).map((opt) => {
                  const selected = when === opt.value;
                  return (
                    <Box
                      key={opt.value}
                      onClick={() => !opt.disabled && setWhen(opt.value)}
                      role="button"
                      tabIndex={opt.disabled ? -1 : 0}
                      onKeyDown={(e) => {
                        if (!opt.disabled && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault();
                          setWhen(opt.value);
                        }
                      }}
                      sx={{
                        display: 'flex', alignItems: 'center', gap: 1.5, p: 1.75,
                        border: '2px solid',
                        borderColor: selected ? 'primary.main' : 'divider',
                        bgcolor: selected ? 'action.selected' : 'transparent',
                        borderRadius: 2,
                        cursor: opt.disabled ? 'not-allowed' : 'pointer',
                        opacity: opt.disabled ? 0.5 : 1,
                        transition: 'border-color .15s, background-color .15s',
                        '&:hover': { borderColor: opt.disabled || selected ? undefined : 'grey.400' },
                      }}
                    >
                      <Typography sx={{ fontSize: '1.5rem', lineHeight: 1 }}>{opt.icon}</Typography>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body2" fontWeight={selected ? 700 : 500}>{opt.title}</Typography>
                        <Typography variant="caption" color="text.secondary">{opt.sub}</Typography>
                      </Box>
                      <Radio checked={selected} disabled={opt.disabled} tabIndex={-1} />
                    </Box>
                  );
                })}
              </Box>

              {when === 'scheduled' && (
                <Box sx={{ mb: 3 }}>
                  {slotsLoading ? (
                    <Typography variant="body2" color="text.secondary">Buscando horarios…</Typography>
                  ) : slots.length === 0 ? (
                    <Alert severity="warning">
                      No hay horarios disponibles para hoy. Elegí <strong>Lo antes posible</strong>.
                    </Alert>
                  ) : (
                    <>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        Horarios de hoy (mínimo 30 minutos desde ahora)
                      </Typography>
                      <Box
                        sx={{
                          display: 'flex', flexDirection: 'column', gap: 0.75,
                          maxHeight: 260, overflowY: 'auto', pr: 0.5,
                        }}
                      >
                        {slots.map((s) => {
                          const selected = slot === s.value;
                          return (
                            <Button
                              key={s.value}
                              onClick={() => setSlot(s.value)}
                              variant={selected ? 'contained' : 'text'}
                              color={selected ? 'primary' : 'inherit'}
                              sx={{
                                borderRadius: 8, py: 1.25, fontWeight: selected ? 700 : 400,
                                color: selected ? undefined : 'text.secondary',
                              }}
                            >
                              {s.from} - {s.to}
                            </Button>
                          );
                        })}
                      </Box>
                    </>
                  )}
                </Box>
              )}

              <Divider sx={{ mb: 3 }} />

              {form.deliveryType === 'DELIVERY' && (
                <>
                  <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                    <TextField label="Calle *" value={form.street} onChange={(e) => handleChange('street', e.target.value)} />
                    <TextField label="Número *" value={form.number} onChange={(e) => handleChange('number', e.target.value)} />
                    <TextField label="Departamento" value={form.apartment} onChange={(e) => handleChange('apartment', e.target.value)} />
                    <TextField
                      label="Ciudad *"
                      value={form.city}
                      onChange={(e) => handleChange('city', e.target.value)}
                      helperText={`Zona de reparto: ${DELIVERY_ZONE_LABEL} y alrededores`}
                    />
                    <TextField label="Provincia" value={form.state} onChange={(e) => handleChange('state', e.target.value)} />
                    <TextField label="Referencia" value={form.reference} onChange={(e) => handleChange('reference', e.target.value)} />
                  </Box>
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                      🛵 Zona de reparto aproximada (podemos llegar a {DELIVERY_ZONE_LABEL} y alrededores)
                    </Typography>
                    <DeliveryZoneMap />
                  </Box>
                </>
              )}

              {/* Viene cargado con el teléfono de la cuenta; es obligatorio
                  porque sin él no se puede coordinar la entrega. */}
              <TextField
                label="Teléfono de contacto *"
                fullWidth
                required
                value={form.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                sx={{ mt: 2 }}
                error={form.phone !== '' && form.phone.trim().length < 6}
                helperText={
                  session?.user.phone
                    ? 'Lo tomamos de tu cuenta; podés cambiarlo para este pedido'
                    : 'Lo necesitamos para avisarte cuando salga tu pedido'
                }
              />
              <TextField
                label="Observaciones del pedido"
                fullWidth
                multiline
                rows={2}
                value={form.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                sx={{ mt: 2 }}
                placeholder="Ej: sin cebolla, con extra queso..."
              />

              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}>
                <Button onClick={() => setActiveStep(0)}>Volver</Button>
                <Button
                  variant="contained"
                  onClick={() => {
                    if (when === 'scheduled' && !slot) {
                      showError('Elegí un horario para tu pedido programado.');
                      return;
                    }
                    setActiveStep(2);
                  }}
                >
                  Continuar
                </Button>
              </Box>
            </Paper>
          )}

          {activeStep === 2 && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>Método de pago</Typography>

              <FormControl component="fieldset" sx={{ mb: 3 }}>
                <RadioGroup
                  value={form.paymentMethod}
                  onChange={(e) => handleChange('paymentMethod', e.target.value)}
                >
                  {/* Nombres cortos y sin marca: "Mercado Pago" empujaba a pagar
                      por ahí (nos cuesta más caro) cuando la transferencia hace
                      lo mismo. El medio de abajo sigue siendo Checkout Pro, con
                      tarjeta o dinero en cuenta. */}
                  <FormControlLabel value="EFECTIVO" control={<Radio />} label="💵 Efectivo al recibir" />
                  <FormControlLabel value="A_DEFINIR" control={<Radio />} label="⏳ Pago al retirar" />
                  <FormControlLabel value="MERCADO_PAGO" control={<Radio />} label="💳 Tarjeta" />
                  <FormControlLabel value="TRANSFERENCIA" control={<Radio />} label="🏦 Transferencia / MP" />
                  <FormControlLabel value="MIXTO" control={<Radio />} label="🔀 Mixto" />
                </RadioGroup>
              </FormControl>

              {form.paymentMethod === 'TRANSFERENCIA' && transferInfoAlert}

              {form.paymentMethod === 'MIXTO' && (
                (() => {
                  const cash = parseFloat(form.cashAmount) || 0;
                  const transfer = parseFloat(form.transferAmount) || 0;
                  const matches = Math.abs(cash + transfer - payTotal) < 0.01;
                  return (
                    <Box sx={{ mb: 3 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                        Repartí el total de <strong>{formatCurrency(payTotal)}</strong> entre efectivo y
                        transferencia (se completan automáticamente).
                      </Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
                        <TextField
                          label="💵 Efectivo"
                          type="number"
                          value={form.cashAmount}
                          onChange={(e) => handleSplitChange('cashAmount', e.target.value)}
                          inputProps={{ min: 0, max: payTotal, step: '0.01' }}
                        />
                        <TextField
                          label="🏦 Transferencia"
                          type="number"
                          value={form.transferAmount}
                          onChange={(e) => handleSplitChange('transferAmount', e.target.value)}
                          inputProps={{ min: 0, max: payTotal, step: '0.01' }}
                        />
                      </Box>
                      <Alert severity={matches ? 'success' : 'error'} sx={{ mt: 1.5 }}>
                        {matches
                          ? `Suma correcta: ${formatCurrency(cash)} + ${formatCurrency(transfer)} = ${formatCurrency(payTotal)}`
                          : `La suma (${formatCurrency(cash + transfer)}) debe ser igual al total (${formatCurrency(payTotal)})`}
                      </Alert>
                      {transfer > 0 && <Box sx={{ mt: 1.5 }}>{transferInfoAlert}</Box>}
                    </Box>
                  );
                })()
              )}

              {/* Propina para el repartidor (opcional, solo delivery) */}
              {form.deliveryType === 'DELIVERY' && (
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                    🛵 Propina para el repartidor (opcional)
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                    {[0, 500, 1000, 2000].map((amt) => (
                      <Button
                        key={amt}
                        size="small"
                        variant={tipNum === amt ? 'contained' : 'outlined'}
                        onClick={() => handleChange('tip', amt === 0 ? '' : String(amt))}
                      >
                        {amt === 0 ? 'Sin propina' : formatCurrency(amt)}
                      </Button>
                    ))}
                    <TextField
                      label="Otro monto"
                      type="number"
                      size="small"
                      value={form.tip}
                      onChange={(e) => handleChange('tip', e.target.value)}
                      inputProps={{ min: 0, step: '50' }}
                      sx={{ width: 120 }}
                    />
                  </Box>
                </Box>
              )}

              {!session && (
                <Alert severity="warning" sx={{ mb: 2 }}>
                  Necesitás iniciar sesión para realizar el pedido
                </Alert>
              )}

              <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
                <Button onClick={() => setActiveStep(1)}>Volver</Button>
                <Button
                  variant="contained"
                  size="large"
                  onClick={session ? handleSubmitOrder : () => router.push('/login?callbackUrl=/checkout')}
                  disabled={
                    loading ||
                    (form.paymentMethod === 'MIXTO' &&
                      Math.abs(
                        (parseFloat(form.cashAmount) || 0) +
                          (parseFloat(form.transferAmount) || 0) -
                          payTotal
                      ) >= 0.01)
                  }
                  sx={{ px: 4 }}
                >
                  {loading ? 'Procesando...' : session ? '✓ Confirmar Pedido' : 'Iniciar Sesión'}
                </Button>
              </Box>
            </Paper>
          )}
        </Box>

        {/* Summary */}
        <Box sx={{ flex: 1, minWidth: 280 }}>
          <Paper sx={{ p: 3, position: 'sticky', top: 80 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>Resumen</Typography>
            <Divider sx={{ mb: 2 }} />
            {when === 'scheduled' && slot && (
              <Alert severity="info" icon={false} sx={{ mb: 2, py: 0.5 }}>
                🕒 Programado para las{' '}
                <strong>{slots.find((s) => s.value === slot)?.from}</strong>
              </Alert>
            )}
            <CartSummary />
            {discountNum > 0 && promo && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography color="success.main" fontWeight={700}>
                  🏷️ {promo.label} ({promo.percentage}%)
                </Typography>
                <Typography color="success.main" fontWeight={700}>− {formatCurrency(discountNum)}</Typography>
              </Box>
            )}
            {tipNum > 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                <Typography color="text.secondary">🛵 Propina repartidor</Typography>
                <Typography>{formatCurrency(tipNum)}</Typography>
              </Box>
            )}
            {(tipNum > 0 || discountNum > 0) && (
              <>
                <Divider sx={{ my: 1 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="h6" fontWeight={700}>Total a pagar</Typography>
                  <Typography variant="h6" fontWeight={700} color="primary">{formatCurrency(payTotal)}</Typography>
                </Box>
              </>
            )}
            {form.deliveryType === 'DELIVERY' && deliveryFee > 0 && (
              <Alert severity="info" sx={{ mt: 2, fontSize: '0.8rem' }}>
                El costo de envío puede variar según tu zona
              </Alert>
            )}
          </Paper>
        </Box>
      </Box>
    </Container>
  );
}
