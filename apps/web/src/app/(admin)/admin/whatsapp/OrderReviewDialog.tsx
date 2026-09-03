'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditIcon from '@mui/icons-material/Edit';
import { useSnackbar } from '@/app/snackbar-context';

export interface ReadyOrderItem {
  productId?: string | null;
  promotionId?: string | null;
  label: string;
  quantity: number;
  unitPrice: number;
  extra?: string | null;
  extraPrice?: number;
  notes: string | null;
}
export interface ReadyOrder {
  items: ReadyOrderItem[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  deliveryType: 'DELIVERY' | 'PICKUP';
  address: { street: string; number: string; apartment: string | null; reference: string | null } | null;
  paymentMethod: 'EFECTIVO' | 'TRANSFERENCIA';
  customerName: string | null;
}
interface MenuItem { id: string; kind: 'product' | 'promo'; name: string; price: number; category: string }

const money = (n: number) => `$${n.toLocaleString('es-AR')}`;
const lineTotal = (it: ReadyOrderItem) => (it.unitPrice + (it.extraPrice || 0)) * it.quantity;

interface Props {
  open: boolean;
  onClose: () => void;
  conversationId: string | null;
  readyOrder: ReadyOrder | null;
  addonOf?: string | null;
  onTaken: (orderNumber: string) => void;
  onEdited?: (view: { readyOrder?: ReadyOrder | null; flow?: string; addonOf?: string | null; humanReason?: string | null }) => void;
}

export default function OrderReviewDialog({ open, onClose, conversationId, readyOrder, addonOf, onTaken, onEdited }: Props) {
  const { showError, showSuccess } = useSnackbar();
  const [editing, setEditing] = useState(false);
  const [items, setItems] = useState<ReadyOrderItem[]>([]);
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [taking, setTaking] = useState(false);

  const isAddon = !!addonOf;

  // Reset SOLO en la transición cerrado → abierto. NO puede depender de
  // `readyOrder`: el panel refresca cada 8 s y devuelve un objeto nuevo aunque el
  // pedido sea idéntico, así que el efecto se re-disparaba y sacaba al operador
  // del modo edición (perdiendo lo que estaba cargando) cada 8 segundos.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setEditing(false);
      setItems(readyOrder ? readyOrder.items.map((it) => ({ ...it })) : []);
    }
    wasOpen.current = open;
  }, [open, readyOrder]);

  // Mientras NO se está editando, el diálogo sí sigue reflejando lo que llega
  // del refresh (si el bot sumó un ítem, se ve). Editando, mandan los cambios
  // del operador.
  useEffect(() => {
    if (!open || editing) return;
    setItems(readyOrder ? readyOrder.items.map((it) => ({ ...it })) : []);
  }, [open, editing, readyOrder]);

  useEffect(() => {
    if (!open || menu.length) return;
    fetch('/api/admin/whatsapp/menu', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setMenu(d.data || []))
      .catch(() => {});
  }, [open, menu.length]);

  // Menú agrupado por categoría (para la grilla de botones).
  const menuByCat = useMemo(() => {
    const m = new Map<string, MenuItem[]>();
    for (const it of menu) {
      const arr = m.get(it.category) ?? [];
      arr.push(it);
      m.set(it.category, arr);
    }
    return [...m.entries()];
  }, [menu]);

  const deliveryFee = readyOrder?.deliveryFee ?? 0;
  const subtotal = useMemo(() => items.reduce((s, it) => s + lineTotal(it), 0), [items]);
  const total = subtotal + (isAddon ? 0 : deliveryFee);

  const setItem = (i: number, patch: Partial<ReadyOrderItem>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const addMenuItem = (m: MenuItem) =>
    setItems((prev) => [
      ...prev,
      {
        productId: m.kind === 'product' ? m.id : null,
        promotionId: m.kind === 'promo' ? m.id : null,
        label: m.name,
        quantity: 1,
        unitPrice: m.price,
        extra: null,
        extraPrice: 0,
        notes: null,
      },
    ]);

  const saveEdit = async () => {
    if (!conversationId) return;
    if (!items.length) { showError('El pedido no puede quedar vacío.'); return; }
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/whatsapp/conversations/${conversationId}/ready-order`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((it) => ({
            productId: it.productId ?? null,
            promotionId: it.promotionId ?? null,
            label: it.label,
            quantity: it.quantity,
            unitPrice: it.unitPrice,
            extra: it.extra ?? null,
            extraPrice: it.extraPrice ?? 0,
            notes: it.notes,
          })),
        }),
      });
      const d = await r.json();
      if (!r.ok) { showError(d.error || 'No se pudo guardar'); return; }
      showSuccess('Pedido actualizado');
      setEditing(false);
      onEdited?.(d);
    } catch {
      showError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const take = async () => {
    if (!conversationId) return;
    setTaking(true);
    try {
      const url = isAddon
        ? `/api/admin/whatsapp/conversations/${conversationId}/take-addon`
        : `/api/admin/whatsapp/conversations/${conversationId}/take-order`;
      const r = await fetch(url, { method: 'POST' });
      const d = await r.json();
      if (!r.ok) { showError(d.error || 'No se pudo tomar el pedido'); return; }
      onTaken(d.orderNumber);
    } catch {
      showError('Error de conexión');
    } finally {
      setTaking(false);
    }
  };

  const busy = saving || taking;

  return (
    <Dialog open={open} onClose={() => !busy && onClose()} maxWidth="sm" fullWidth>
      <DialogTitle>
        {isAddon ? `Agregado al pedido #${addonOf}` : 'Revisá el pedido'}
        {editing && ' — editar'}
      </DialogTitle>
      <DialogContent dividers>
        {!readyOrder ? (
          <Typography color="text.secondary">No hay un pedido listo.</Typography>
        ) : (
          <>
            {readyOrder.customerName && (
              <Typography variant="body2" sx={{ mb: 1 }}><b>Cliente:</b> {readyOrder.customerName}</Typography>
            )}

            {/* Ítems */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: editing ? 1.25 : 0.75, mb: 1.5 }}>
              {items.map((it, i) =>
                editing ? (
                  <Box key={i} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ flex: 1 }}>{it.label}</Typography>
                      <IconButton size="small" color="error" onClick={() => removeItem(i)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap' }}>
                      <TextField
                        label="Cant." type="number" size="small" sx={{ width: 72 }}
                        value={it.quantity}
                        onChange={(e) => setItem(i, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                        inputProps={{ min: 1 }}
                      />
                      <TextField
                        label="Precio base" type="number" size="small" sx={{ width: 120 }}
                        value={it.unitPrice}
                        onChange={(e) => setItem(i, { unitPrice: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                        inputProps={{ min: 0 }}
                      />
                      {it.extra != null && (
                        <TextField
                          label={`Precio extra (${it.extra})`} type="number" size="small" sx={{ width: 150 }}
                          value={it.extraPrice ?? 0}
                          onChange={(e) => setItem(i, { extraPrice: Math.max(0, parseInt(e.target.value, 10) || 0) })}
                          inputProps={{ min: 0 }}
                          color="warning" focused
                        />
                      )}
                      <Typography variant="body2" sx={{ alignSelf: 'center', ml: 'auto', fontWeight: 700 }}>
                        {money(lineTotal(it))}
                      </Typography>
                    </Box>
                    <TextField
                      label="Aclaraciones" size="small" fullWidth sx={{ mt: 1 }}
                      value={it.notes ?? ''}
                      onChange={(e) => setItem(i, { notes: e.target.value })}
                      multiline maxRows={3}
                    />
                  </Box>
                ) : (
                  <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                    <Box>
                      <Typography variant="body2">{it.quantity > 1 ? `${it.quantity}× ` : ''}{it.label}</Typography>
                      {it.extra && (
                        <Typography variant="caption" color={it.extraPrice ? 'text.secondary' : 'error.main'} sx={{ display: 'block' }}>
                          + extra {it.extra} {it.extraPrice ? `(${money(it.extraPrice)} c/u)` : '(sin precio ⚠️)'}
                        </Typography>
                      )}
                      {it.notes && <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'pre-wrap', display: 'block' }}>{it.notes}</Typography>}
                    </Box>
                    <Typography variant="body2" sx={{ whiteSpace: 'nowrap' }}>{money(lineTotal(it))}</Typography>
                  </Box>
                )
              )}
            </Box>

            {/* Agregar ítem con botones por categoría (como el mostrador) */}
            {editing && (
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Agregar ítem</Typography>
                <Box sx={{ maxHeight: 220, overflowY: 'auto', pr: 0.5 }}>
                  {menuByCat.map(([cat, list]) => (
                    <Box key={cat} sx={{ mb: 1 }}>
                      <Typography variant="caption" color="text.secondary">{cat}</Typography>
                      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 0.5, mt: 0.25 }}>
                        {list.map((m) => (
                          <Button
                            key={m.id} size="small" variant="outlined"
                            onClick={() => addMenuItem(m)}
                            sx={{ textTransform: 'none', flexDirection: 'column', py: 0.5, lineHeight: 1.15 }}
                          >
                            <span>{m.name}</span>
                            <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>{money(m.price)}</span>
                          </Button>
                        ))}
                      </Box>
                    </Box>
                  ))}
                  {menu.length === 0 && <Typography variant="caption" color="text.secondary">Cargando menú…</Typography>}
                </Box>
              </Box>
            )}

            <Divider sx={{ my: 1 }} />
            <Row label="Subtotal" value={money(subtotal)} />
            {readyOrder.deliveryType === 'DELIVERY' && !isAddon && <Row label="Envío" value={money(deliveryFee)} />}
            <Row label={isAddon ? 'Total agregado' : 'Total'} value={money(total)} bold />
            <Divider sx={{ my: 1 }} />
            <Row label="Entrega" value={readyOrder.deliveryType === 'DELIVERY' ? 'Delivery' : 'Retira'} />
            {readyOrder.deliveryType === 'DELIVERY' && readyOrder.address && (
              <Row label="Dirección" value={`${readyOrder.address.street} ${readyOrder.address.number}${readyOrder.address.apartment ? ' ' + readyOrder.address.apartment : ''}${readyOrder.address.reference ? ' — ' + readyOrder.address.reference : ''}`} />
            )}
            <Row label="Pago" value={readyOrder.paymentMethod === 'TRANSFERENCIA' ? 'Transferencia' : 'Efectivo'} />
          </>
        )}
      </DialogContent>
      <DialogActions>
        {editing ? (
          <>
            <Button onClick={() => { setEditing(false); setItems(readyOrder ? readyOrder.items.map((it) => ({ ...it })) : []); }} disabled={saving}>
              Cancelar edición
            </Button>
            <Button variant="contained" onClick={saveEdit} disabled={saving}>Guardar cambios</Button>
          </>
        ) : (
          <>
            <Button onClick={onClose} disabled={taking}>Cerrar</Button>
            <Button startIcon={<EditIcon />} onClick={() => setEditing(true)} disabled={!readyOrder || taking}>Editar</Button>
            <Button
              variant="contained"
              color={isAddon ? 'warning' : 'success'}
              onClick={take}
              disabled={taking || !readyOrder}
            >
              {isAddon ? 'Confirmar agregado' : 'Confirmar y mandar a Pedidos'}
            </Button>
          </>
        )}
      </DialogActions>
    </Dialog>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, py: 0.25 }}>
      <Typography variant="body2" color="text.secondary">{label}</Typography>
      <Typography variant="body2" fontWeight={bold ? 700 : 400} sx={{ textAlign: 'right' }}>{value}</Typography>
    </Box>
  );
}
