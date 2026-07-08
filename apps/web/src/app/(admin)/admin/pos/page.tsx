'use client';

import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import TextField from '@mui/material/TextField';
import RadioGroup from '@mui/material/RadioGroup';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import Checkbox from '@mui/material/Checkbox';
import Divider from '@mui/material/Divider';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useProducts, useCategories, usePromotions } from '@/hooks/useProducts';
import { PizzaCounterModal } from '@/components/products/PizzaCounterModal';
import { EmpanadaDozenModal } from '@/components/products/EmpanadaDozenModal';
import { EmpanadaLooseModal } from '@/components/products/EmpanadaLooseModal';
import { EmpanadaPickModal } from '@/components/products/EmpanadaPickModal';
import { DobleCambalacheDialog } from '@/components/products/DobleCambalacheDialog';
import { DrinkModal } from '@/components/products/DrinkModal';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useSnackbar } from '@/app/snackbar-context';
import { formatCurrency, formatDozensNotes } from '@/lib/utils';
import { flavorsForSize, formatPizzaName, formatPizzaNotes } from '@/lib/pizza';
import { promoEmpanadaCount, formatPromoNotes } from '@/lib/promos';
import { PIZZA_SIZES, PIZZA_SIZE_LABELS, type PizzaSize } from '@/types/product.types';

/** Empanada especial que no es un "gusto" para docenas/sueltas. */
const isDobleCambalache = (name: string) => /doble cambalache/i.test(name);

const DOZEN_PROMO_ID = 'promo-docena-empanadas';
const DELIVERY_FEE = 0; // El envío es sin cargo.

type DrinkCat = 'GRANDE' | 'MEDIANA' | 'CHICA';

const DRINK_CATS: { key: DrinkCat; label: string }[] = [
  { key: 'GRANDE', label: 'Bebida grande' },
  { key: 'MEDIANA', label: 'Bebida mediana' },
  { key: 'CHICA', label: 'Bebida chica' },
];

/** Litros derivados del nombre de la bebida (ej. "Coca-Cola 1.5L" -> 1.5). */
function drinkLiters(name: string): number | null {
  const m = name.match(/([\d]+(?:[.,][\d]+)?)\s*(l(?:t|itros?)?|ml|cc)\b/i);
  if (!m) return null;
  const value = parseFloat(m[1].replace(',', '.'));
  const unit = m[2].toLowerCase();
  return unit.startsWith('ml') || unit === 'cc' ? value / 1000 : value;
}

/** Categoría por litros: <1L chica, 1–<2L mediana, ≥2L grande. */
function drinkCategory(name: string): DrinkCat {
  const l = drinkLiters(name);
  if (l == null) return 'MEDIANA'; // sin volumen reconocible: la dejamos en mediana
  if (l >= 2) return 'GRANDE';
  if (l >= 1) return 'MEDIANA';
  return 'CHICA';
}

interface PosItem {
  key: string;
  productId?: string;
  promotionId?: string;
  name: string;
  unitPrice: number;
  quantity: number;
  notes?: string;
}

export default function PosPage() {
  const { products, loading } = useProducts({ available: true });
  const { categories } = useCategories();
  const { promotions } = usePromotions(true);
  const { showError, showSuccess } = useSnackbar();

  const [items, setItems] = useState<PosItem[]>([]);
  const [tab, setTab] = useState<string>('');
  const [pizzaOpen, setPizzaOpen] = useState(false);
  const [dozenOpen, setDozenOpen] = useState(false);
  const [looseOpen, setLooseOpen] = useState(false);
  const [drinkCat, setDrinkCat] = useState<DrinkCat | null>(null);
  const [dobleOpen, setDobleOpen] = useState(false);
  // Promo con empanadas "a elección" pendiente de armar.
  const [promoPick, setPromoPick] = useState<{ id: string; name: string; price: number; count: number } | null>(null);

  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryType, setDeliveryType] = useState<'PICKUP' | 'DELIVERY'>('PICKUP');
  const [address, setAddress] = useState({ street: '', number: '', apartment: '', city: '', reference: '' });
  const [paymentMethod, setPaymentMethod] = useState<'EFECTIVO' | 'TRANSFERENCIA' | 'TARJETA' | 'MIXTO' | 'A_DEFINIR'>('EFECTIVO');
  const [cashAmount, setCashAmount] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [paid, setPaid] = useState(false);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pizzasCategoryId = useMemo(() => categories.find((c) => c.slug === 'pizzas')?.id, [categories]);
  const empanadasCategoryId = useMemo(() => categories.find((c) => c.slug === 'empanadas')?.id, [categories]);
  const bebidasCategoryId = useMemo(() => categories.find((c) => c.slug === 'bebidas')?.id, [categories]);
  const pizzas = useMemo(() => products.filter((p) => p.categoryId === pizzasCategoryId), [products, pizzasCategoryId]);
  const empanadas = useMemo(
    () => products.filter((p) => p.categoryId === empanadasCategoryId && p.available && !isDobleCambalache(p.name)),
    [products, empanadasCategoryId]
  );
  const dobleCambalache = useMemo(
    () => products.find((p) => p.categoryId === empanadasCategoryId && p.available && isDobleCambalache(p.name)),
    [products, empanadasCategoryId]
  );
  const bebidas = useMemo(() => products.filter((p) => p.categoryId === bebidasCategoryId), [products, bebidasCategoryId]);
  const drinksInCat = useMemo(
    () => (drinkCat ? bebidas.filter((b) => drinkCategory(b.name) === drinkCat) : []),
    [bebidas, drinkCat]
  );
  const dozenPromo = useMemo(
    () => promotions.find((p) => p.id === DOZEN_PROMO_ID) || promotions.find((p) => /docena/i.test(p.name)),
    [promotions]
  );
  const regularPromos = useMemo(
    () => promotions.filter((p) => p.id !== DOZEN_PROMO_ID && !/docena/i.test(p.name)),
    [promotions]
  );

  // Tab inicial: la primera categoría disponible.
  const activeTab = tab || categories[0]?.id || 'promos';

  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const deliveryFee = deliveryType === 'DELIVERY' ? DELIVERY_FEE : 0;
  const total = subtotal + deliveryFee;

  const addItem = (item: Omit<PosItem, 'key'>) => {
    setItems((prev) => {
      // Ítems simples (sin notas) se agrupan; pizzas/docenas son líneas únicas.
      if (!item.notes) {
        const idx = prev.findIndex(
          (p) => !p.notes && p.productId === item.productId && p.promotionId === item.promotionId
        );
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + item.quantity };
          return copy;
        }
      }
      return [...prev, { ...item, key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }];
    });
  };

  const setQty = (key: string, delta: number) => {
    setItems((prev) =>
      prev
        .map((i) => (i.key === key ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0)
    );
  };

  const removeItem = (key: string) => setItems((prev) => prev.filter((i) => i.key !== key));

  const resetCart = () => {
    setItems([]);
    setCustomerName('');
    setPhone('');
    setNotes('');
    setAddress({ street: '', number: '', apartment: '', city: '', reference: '' });
    setCashAmount('');
    setTransferAmount('');
    setPaid(false);
    setPaymentMethod('EFECTIVO');
    setDeliveryType('PICKUP');
  };

  const handleSplit = (field: 'cash' | 'transfer', value: string) => {
    const raw = parseFloat(value);
    const amount = Math.min(Math.max(Number.isNaN(raw) ? 0 : raw, 0), total);
    const other = Math.round((total - amount) * 100) / 100;
    if (field === 'cash') { setCashAmount(value === '' ? '' : String(amount)); setTransferAmount(String(other)); }
    else { setTransferAmount(value === '' ? '' : String(amount)); setCashAmount(String(other)); }
  };

  const finalize = async () => {
    if (items.length === 0) { showError('Agregá al menos un producto'); return; }
    if (deliveryType === 'DELIVERY' && (!address.street || !address.number || !address.city)) {
      showError('Completá la dirección de entrega'); return;
    }
    const cash = parseFloat(cashAmount) || 0;
    const transfer = parseFloat(transferAmount) || 0;
    if (paymentMethod === 'MIXTO' && Math.abs(cash + transfer - total) >= 0.01) {
      showError('El efectivo y la transferencia deben sumar el total'); return;
    }

    const composedNotes = [customerName ? `Cliente: ${customerName}` : '', notes].filter(Boolean).join(' · ');

    const payload = {
      deliveryType,
      paymentMethod,
      subtotal,
      deliveryFee,
      total,
      paid,
      ...(paymentMethod === 'MIXTO' ? { cashAmount: cash, transferAmount: transfer } : {}),
      ...(deliveryType === 'DELIVERY'
        ? {
            address: {
              street: address.street,
              number: address.number,
              apartment: address.apartment || undefined,
              city: address.city,
              reference: address.reference || undefined,
            },
          }
        : {}),
      notes: composedNotes || undefined,
      phone: phone || undefined,
      items: items.map((i) => ({
        productId: i.productId,
        promotionId: i.promotionId,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        notes: i.notes,
      })),
    };

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { showError(json.error || 'No se pudo cargar el pedido'); return; }
      showSuccess(`Pedido #${json.data.orderNumber} cargado · se envió a imprimir`);
      resetCart();
    } catch {
      showError('Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner message="Cargando productos..." />;

  const tile = (label: string, price: number | string, onClick: () => void, key: string) => (
    <Button
      key={key}
      variant="outlined"
      onClick={onClick}
      sx={{
        flexDirection: 'column', alignItems: 'flex-start', textAlign: 'left', p: 1.5,
        height: '100%', textTransform: 'none', borderColor: 'divider',
      }}
    >
      <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.2 }}>{label}</Typography>
      <Typography variant="caption" color="primary.main" fontWeight={700}>
        {typeof price === 'number' ? formatCurrency(price) : price}
      </Typography>
    </Button>
  );

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>Mostrador · Nuevo pedido</Typography>

      <Box sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', md: 'row' }, alignItems: 'flex-start' }}>
        {/* Catálogo */}
        <Paper sx={{ flex: 2, p: 2, width: '100%' }}>
          <Tabs value={activeTab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ mb: 2 }}>
            {categories.map((c) => <Tab key={c.id} value={c.id} label={`${c.icon || ''} ${c.name}`} />)}
            {regularPromos.length > 0 && <Tab value="promos" label="🏷️ Promos" />}
          </Tabs>

          {/* Pizzas: un solo botón que abre el panel con tamaños + gustos */}
          {activeTab === pizzasCategoryId && (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 1.5 }}>
              <Button variant="contained" sx={{ py: 3, textTransform: 'none', fontSize: '1.1rem' }}
                onClick={() => setPizzaOpen(true)}>
                🍕 Pizza
              </Button>
            </Box>
          )}

          {/* Empanadas: por docena o sueltas */}
          {activeTab === empanadasCategoryId && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(2, 1fr)' }, gap: 1.5 }}>
              {dozenPromo && (
                <Button variant="contained" color="secondary" sx={{ py: 3, textTransform: 'none', flexDirection: 'column' }} onClick={() => setDozenOpen(true)}>
                  <span style={{ fontSize: '1.5rem' }}>🥟</span>
                  Por docena
                  <span style={{ fontSize: '0.8rem' }}>{formatCurrency(Number(dozenPromo.promotionalPrice))}</span>
                </Button>
              )}
              <Button variant="contained" sx={{ py: 3, textTransform: 'none', flexDirection: 'column' }} disabled={empanadas.length === 0} onClick={() => setLooseOpen(true)}>
                <span style={{ fontSize: '1.5rem' }}>🥟</span>
                Sueltas
                <span style={{ fontSize: '0.8rem' }}>precio por unidad</span>
              </Button>
              {dobleCambalache && (
                <Button variant="outlined" color="secondary" sx={{ py: 3, textTransform: 'none', flexDirection: 'column' }}
                  onClick={() => setDobleOpen(true)}>
                  <span style={{ fontSize: '1.5rem' }}>🥟</span>
                  Doble Cambalache
                  <span style={{ fontSize: '0.8rem' }}>{formatCurrency(Number(dobleCambalache.price))}</span>
                </Button>
              )}
            </Box>
          )}

          {/* Promos */}
          {activeTab === 'promos' && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5 }}>
              {regularPromos.map((p) => tile(p.name, Number(p.promotionalPrice),
                () => {
                  const count = promoEmpanadaCount(p.id);
                  if (count > 0) {
                    setPromoPick({ id: p.id, name: p.name, price: Number(p.promotionalPrice), count });
                  } else {
                    addItem({ promotionId: p.id, name: p.name, unitPrice: Number(p.promotionalPrice), quantity: 1, notes: formatPromoNotes(p.id) || undefined });
                  }
                }, p.id))}
            </Box>
          )}

          {/* Bebidas: 3 tamaños; cada uno abre un modal con las bebidas de ese tamaño */}
          {activeTab === bebidasCategoryId && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5 }}>
              {DRINK_CATS.map((c) => (
                <Button
                  key={c.key}
                  variant="contained"
                  sx={{ py: 3, textTransform: 'none', flexDirection: 'column' }}
                  onClick={() => setDrinkCat(c.key)}
                >
                  <span style={{ fontSize: '1.6rem' }}>🥤</span>
                  {c.label}
                </Button>
              ))}
            </Box>
          )}

          {/* Otras categorías: productos sueltos */}
          {activeTab !== pizzasCategoryId && activeTab !== empanadasCategoryId && activeTab !== bebidasCategoryId && activeTab !== 'promos' && (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(3, 1fr)' }, gap: 1.5 }}>
              {products.filter((p) => p.categoryId === activeTab).map((p) => tile(p.name, Number(p.price),
                () => addItem({ productId: p.id, name: p.name, unitPrice: Number(p.price), quantity: 1 }), p.id))}
            </Box>
          )}
        </Paper>

        {/* Pedido */}
        <Paper sx={{ flex: 1, p: 2, width: '100%', minWidth: { md: 320 }, position: { md: 'sticky' }, top: { md: 80 } }}>
          <Typography variant="h6" fontWeight={700} gutterBottom>Pedido</Typography>

          {items.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 2 }}>Tocá productos para agregarlos.</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1 }}>
              {items.map((i) => (
                <Box key={i.key} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={600}>{i.name}</Typography>
                    {i.notes && (
                      <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-line', display: 'block' }}>{i.notes}</Typography>
                    )}
                    <Typography variant="caption" color="text.secondary">{formatCurrency(i.unitPrice * i.quantity)}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <IconButton size="small" onClick={() => setQty(i.key, -1)}><RemoveIcon fontSize="small" /></IconButton>
                    <Typography variant="body2" sx={{ minWidth: 20, textAlign: 'center' }}>{i.quantity}</Typography>
                    <IconButton size="small" onClick={() => setQty(i.key, 1)}><AddIcon fontSize="small" /></IconButton>
                    <IconButton size="small" color="error" onClick={() => removeItem(i.key)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                  </Box>
                </Box>
              ))}
            </Box>
          )}

          <Divider sx={{ my: 1.5 }} />

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <TextField label="Cliente" size="small" fullWidth value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
              <TextField label="Teléfono" size="small" fullWidth value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Box>

            <RadioGroup row value={deliveryType} onChange={(e) => setDeliveryType(e.target.value as 'PICKUP' | 'DELIVERY')}>
              <FormControlLabel value="PICKUP" control={<Radio size="small" />} label="🏪 Retiro" />
              <FormControlLabel value="DELIVERY" control={<Radio size="small" />} label="🛵 Delivery" />
            </RadioGroup>

            {deliveryType === 'DELIVERY' && (
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <TextField label="Calle *" size="small" value={address.street} onChange={(e) => setAddress({ ...address, street: e.target.value })} />
                <TextField label="Número *" size="small" value={address.number} onChange={(e) => setAddress({ ...address, number: e.target.value })} />
                <TextField label="Depto" size="small" value={address.apartment} onChange={(e) => setAddress({ ...address, apartment: e.target.value })} />
                <TextField label="Ciudad *" size="small" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
                <TextField label="Referencia" size="small" sx={{ gridColumn: 'span 2' }} value={address.reference} onChange={(e) => setAddress({ ...address, reference: e.target.value })} />
              </Box>
            )}

            <RadioGroup row value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}>
              <FormControlLabel value="EFECTIVO" control={<Radio size="small" />} label="💵 Efectivo" />
              <FormControlLabel value="TRANSFERENCIA" control={<Radio size="small" />} label="🏦 Transf." />
              <FormControlLabel value="TARJETA" control={<Radio size="small" />} label="💳 QR o Tarjeta" />
              <FormControlLabel value="MIXTO" control={<Radio size="small" />} label="🔀 Mixto" />
              <FormControlLabel value="A_DEFINIR" control={<Radio size="small" />} label="⏳ A definir" />
            </RadioGroup>

            {paymentMethod === 'MIXTO' && (
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <TextField label="Efectivo" size="small" type="number" value={cashAmount} onChange={(e) => handleSplit('cash', e.target.value)} />
                <TextField label="Transferencia" size="small" type="number" value={transferAmount} onChange={(e) => handleSplit('transfer', e.target.value)} />
              </Box>
            )}

            <FormControlLabel
              sx={{ ml: 0 }}
              control={<Checkbox size="small" checked={paid} onChange={(e) => setPaid(e.target.checked)} />}
              label={paid ? '✅ Pagó (el ticket sale sin «FALTA COBRAR»)' : '💰 Pagó'}
            />

            <TextField label="Observaciones" size="small" multiline value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Box>

          <Divider sx={{ my: 1.5 }} />

          <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
            <Typography color="text.secondary">Subtotal</Typography>
            <Typography>{formatCurrency(subtotal)}</Typography>
          </Box>
          {deliveryFee > 0 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography color="text.secondary">Envío</Typography>
              <Typography>{formatCurrency(deliveryFee)}</Typography>
            </Box>
          )}
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.5 }}>
            <Typography variant="h6" fontWeight={700}>Total</Typography>
            <Typography variant="h6" fontWeight={700} color="primary">{formatCurrency(total)}</Typography>
          </Box>

          <Alert severity="info" icon={false} sx={{ mt: 1, py: 0.5 }}>
            <Typography variant="caption">Al finalizar se confirma e imprime en la estación (cocina + comanda).</Typography>
          </Alert>

          <Button variant="contained" size="large" fullWidth sx={{ mt: 1.5, py: 1.5 }} disabled={submitting || items.length === 0} onClick={finalize}>
            {submitting ? 'Cargando…' : `Finalizar · ${formatCurrency(total)}`}
          </Button>
          {items.length > 0 && (
            <Button fullWidth size="small" color="inherit" sx={{ mt: 0.5 }} onClick={resetCart} disabled={submitting}>
              Vaciar
            </Button>
          )}
        </Paper>
      </Box>

      {/* Modales reutilizados del menú del cliente */}
      <PizzaCounterModal
        open={pizzaOpen}
        onClose={() => setPizzaOpen(false)}
        pizzas={pizzas}
        onConfirm={(lines) => {
          lines.forEach((l) =>
            addItem({ productId: l.productId, name: l.name, unitPrice: l.unitPrice, quantity: l.quantity, notes: l.notes })
          );
          setPizzaOpen(false);
        }}
      />
      {dozenPromo && (
        <EmpanadaDozenModal
          open={dozenOpen}
          onClose={() => setDozenOpen(false)}
          empanadas={empanadas}
          dozenPrice={Number(dozenPromo.promotionalPrice)}
          promotionName={dozenPromo.name}
          onConfirm={({ dozenCount, dozens, unitPrice }) => {
            addItem({
              promotionId: dozenPromo.id,
              name: dozenCount === 1 ? dozenPromo.name : `${dozenPromo.name} x${dozenCount}`,
              unitPrice,
              quantity: dozenCount,
              notes: formatDozensNotes(dozens),
            });
            setDozenOpen(false);
          }}
        />
      )}
      <EmpanadaLooseModal
        open={looseOpen}
        onClose={() => setLooseOpen(false)}
        empanadas={empanadas}
        onConfirm={(selection) => {
          selection.forEach((s) =>
            addItem({ productId: s.productId, name: s.name, unitPrice: s.unitPrice, quantity: s.quantity })
          );
          setLooseOpen(false);
        }}
      />
      <DrinkModal
        open={drinkCat !== null}
        onClose={() => setDrinkCat(null)}
        title={DRINK_CATS.find((c) => c.key === drinkCat)?.label ?? 'Bebidas'}
        drinks={drinksInCat}
        onConfirm={(picks) => {
          picks.forEach((p) => addItem({ productId: p.productId, name: p.name, unitPrice: p.unitPrice, quantity: p.quantity }));
          setDrinkCat(null);
        }}
      />
      <EmpanadaPickModal
        open={promoPick !== null}
        onClose={() => setPromoPick(null)}
        title={promoPick ? `${promoPick.name} · elegí ${promoPick.count} empanadas` : ''}
        count={promoPick?.count ?? 0}
        empanadas={empanadas}
        onConfirm={(chosen) => {
          if (promoPick) {
            addItem({
              promotionId: promoPick.id,
              name: promoPick.name,
              unitPrice: promoPick.price,
              quantity: 1,
              notes: formatPromoNotes(promoPick.id, chosen) || undefined,
            });
          }
          setPromoPick(null);
        }}
      />
      {dobleCambalache && (
        <DobleCambalacheDialog
          open={dobleOpen}
          onClose={() => setDobleOpen(false)}
          price={Number(dobleCambalache.price)}
          onConfirm={(notes) => {
            addItem({ productId: dobleCambalache.id, name: dobleCambalache.name, unitPrice: Number(dobleCambalache.price), quantity: 1, notes });
            setDobleOpen(false);
          }}
        />
      )}
    </Box>
  );
}
