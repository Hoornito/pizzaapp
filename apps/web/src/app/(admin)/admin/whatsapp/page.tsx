'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Chip from '@mui/material/Chip';
import Badge from '@mui/material/Badge';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import SendIcon from '@mui/icons-material/Send';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import EditIcon from '@mui/icons-material/Edit';
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import { useSnackbar } from '@/app/snackbar-context';
import OrderReviewDialog, { type ReadyOrder } from './OrderReviewDialog';

type Flow = 'normal' | 'ready' | 'needs_human';

interface Convo {
  id: string;
  phone: string;
  contactName: string | null;
  botPaused: boolean;
  unread: number;
  lastMessageAt: string | null;
  flow: Flow;
  addonOf: string | null;
  lastMessage: { body: string | null; type: string; direction: string } | null;
}
interface Msg {
  id: string;
  direction: 'IN' | 'OUT';
  type: string;
  body: string | null;
  mediaUrl: string | null;
  status: string | null;
  createdAt: string;
}

const fmtTime = (d: string | null) =>
  d ? new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';

const preview = (c: Convo) => {
  if (!c.lastMessage) return 'Sin mensajes';
  if (c.lastMessage.type === 'image') return '📷 Imagen';
  const b = c.lastMessage.body || '';
  return (c.lastMessage.direction === 'OUT' ? 'Vos: ' : '') + (b.length > 40 ? b.slice(0, 40) + '…' : b);
};

// Fondo de la caja del chat según su estado (verde/rojo, bien visible).
const GREEN = 'rgba(46,125,50,0.16)';
const GREEN_SEL = 'rgba(46,125,50,0.30)';
const RED = 'rgba(211,47,47,0.14)';
const RED_SEL = 'rgba(211,47,47,0.28)';
const flowBg = (flow: Flow, selected: boolean) => {
  if (flow === 'ready') return { borderLeft: '6px solid', borderLeftColor: 'success.main', bgcolor: selected ? GREEN_SEL : GREEN };
  if (flow === 'needs_human') return { borderLeft: '6px solid', borderLeftColor: 'error.main', bgcolor: selected ? RED_SEL : RED };
  return { borderLeft: '6px solid transparent', bgcolor: selected ? 'action.selected' : 'transparent' };
};

export default function WhatsAppInboxPage() {
  const { showError, showSuccess } = useSnackbar();
  const [convos, setConvos] = useState<Convo[]>([]);
  const [selected, setSelected] = useState<Convo | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [threadFlow, setThreadFlow] = useState<Flow>('normal');
  const [readyOrder, setReadyOrder] = useState<ReadyOrder | null>(null);
  const [addonOf, setAddonOf] = useState<string | null>(null);
  const [humanReason, setHumanReason] = useState<string | null>(null);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [takeOpen, setTakeOpen] = useState(false);
  const [aiDisabled, setAiDisabled] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const loadConvos = useCallback(() => {
    fetch('/api/admin/whatsapp/conversations', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setConvos(d.data || []))
      .catch(() => {});
  }, []);

  const loadMessages = useCallback((id: string) => {
    fetch(`/api/admin/whatsapp/conversations/${id}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setMessages(d.data || []);
        setThreadFlow((d.flow as Flow) || 'normal');
        setReadyOrder(d.readyOrder || null);
        setAddonOf(d.addonOf || null);
        setHumanReason(d.humanReason || null);
      })
      .catch(() => {});
  }, []);

  const loadAiStatus = useCallback(() => {
    fetch('/api/admin/whatsapp/ai', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setAiDisabled(!!d.disabled))
      .catch(() => {});
  }, []);

  useEffect(() => { loadConvos(); loadAiStatus(); }, [loadConvos, loadAiStatus]);
  useEffect(() => {
    const t = setInterval(() => {
      loadConvos();
      if (selected) loadMessages(selected.id);
    }, 8000);
    return () => clearInterval(t);
  }, [selected, loadConvos, loadMessages]);

  useEffect(() => {
    threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
  }, [messages]);

  const openConvo = (c: Convo) => {
    setSelected(c);
    setMessages([]);
    setReadyOrder(null);
    setAddonOf(null);
    setHumanReason(null);
    setThreadFlow(c.flow);
    loadMessages(c.id);
    setConvos((prev) => prev.map((x) => (x.id === c.id ? { ...x, unread: 0 } : x)));
  };

  const sendReply = async () => {
    if (!selected || !reply.trim()) return;
    setSending(true);
    try {
      const res = await fetch(`/api/admin/whatsapp/conversations/${selected.id}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: reply.trim() }),
      });
      const json = await res.json();
      if (!res.ok) { showError(json.error || 'Error al responder'); return; }
      if (json.sent === false) showError('Guardado, pero no se pudo enviar (¿número/token de WhatsApp sin configurar?)');
      setReply('');
      loadMessages(selected.id);
    } catch {
      showError('Error de conexión');
    } finally {
      setSending(false);
    }
  };

  // Renombrar el contacto: arranca con el nombre de perfil de WhatsApp y se
  // corrige a mano. Ese nombre es el que después aparece en Pedidos.
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const saveName = async () => {
    if (!selected || nameDraft === null) return;
    const value = nameDraft.trim();
    try {
      const res = await fetch(`/api/admin/whatsapp/conversations/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactName: value }),
      });
      if (!res.ok) { showError('No se pudo guardar el nombre'); return; }
      const saved = value || null;
      setSelected((c) => (c ? { ...c, contactName: saved } : c));
      setConvos((prev) => prev.map((x) => (x.id === selected.id ? { ...x, contactName: saved } : x)));
      setNameDraft(null);
    } catch {
      showError('Error de conexión');
    }
  };

  // Limpiar el hilo: herramienta de PRUEBA para ensayar pedidos distintos desde
  // el mismo teléfono sin que el bot arrastre la charla anterior.
  const [clearing, setClearing] = useState(false);
  const clearThread = async () => {
    if (!selected) return;
    const quien = selected.contactName || selected.phone;
    if (!confirm(`¿Borrar todo el historial de ${quien}? Se borran los mensajes y el pedido armado; los pedidos ya tomados NO se tocan. No se puede deshacer.`)) return;
    setClearing(true);
    try {
      const res = await fetch(`/api/admin/whatsapp/conversations/${selected.id}`, { method: 'DELETE' });
      if (!res.ok) { showError('No se pudo limpiar el chat'); return; }
      showSuccess('Chat limpio ✓');
      setMessages([]);
      loadConvos();
      loadMessages(selected.id);
    } catch {
      showError('Error de conexión');
    } finally {
      setClearing(false);
    }
  };

  const toggleBot = async () => {
    if (!selected) return;
    const paused = !selected.botPaused;
    try {
      const res = await fetch(`/api/admin/whatsapp/conversations/${selected.id}/bot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused }),
      });
      if (!res.ok) throw new Error();
      setSelected((s) => (s ? { ...s, botPaused: paused } : s));
      setConvos((prev) => prev.map((x) => (x.id === selected.id ? { ...x, botPaused: paused } : x)));
      // Reactivar la IA hace que retome el pedido: refrescamos con un pequeño delay.
      if (!paused) setTimeout(() => loadMessages(selected.id), 900);
    } catch {
      showError('No se pudo cambiar el modo');
    }
  };

  const toggleGlobalAI = async () => {
    const disabled = !aiDisabled;
    try {
      const res = await fetch('/api/admin/whatsapp/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled }),
      });
      if (!res.ok) throw new Error();
      setAiDisabled(disabled);
      showSuccess(disabled ? 'IA apagada en todos los chats' : 'IA reactivada');
    } catch {
      showError('No se pudo cambiar la IA global');
    }
  };

  const onTaken = (orderNumber: string) => {
    showSuccess(`Pedido #${orderNumber} enviado a Pedidos ✅`);
    setTakeOpen(false);
    setReadyOrder(null);
    setAddonOf(null);
    setHumanReason(null);
    setThreadFlow('normal');
    loadConvos();
    if (selected) setTimeout(() => loadMessages(selected.id), 400);
  };

  const onEdited = (d: { readyOrder?: ReadyOrder | null; flow?: string; addonOf?: string | null; humanReason?: string | null }) => {
    setReadyOrder(d.readyOrder || null);
    if (d.flow) setThreadFlow(d.flow as Flow);
    setAddonOf(d.addonOf || null);
    setHumanReason(d.humanReason || null);
    if (selected) loadMessages(selected.id);
  };

  const takeLabel = addonOf ? `Tomar agregado #${addonOf}` : 'Tomar pedido';

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <Typography variant="h4" fontWeight={700}>WhatsApp</Typography>
        {aiDisabled && <Chip color="error" size="small" label="IA apagada (global)" />}
        <Box sx={{ flex: 1 }} />
        <Button
          onClick={toggleGlobalAI}
          variant={aiDisabled ? 'contained' : 'outlined'}
          color={aiDisabled ? 'error' : 'inherit'}
          size="small"
          startIcon={<PowerSettingsNewIcon />}
        >
          {aiDisabled ? 'Reactivar IA' : 'Apagar IA (global)'}
        </Button>
        <Button component={Link} href="/admin/whatsapp/sim" variant="outlined" size="small" startIcon={<SmartToyIcon />}>
          Simulador
        </Button>
        <Button component={Link} href="/admin/whatsapp/bot" variant="outlined" size="small" startIcon={<AutoFixHighIcon />}>
          Entrenar al bot
        </Button>
      </Box>
      <Paper variant="outlined" sx={{ display: 'flex', height: { xs: 'calc(100vh - 200px)', md: '72vh' }, overflow: 'hidden' }}>
        {/* Lista de conversaciones */}
        <Box
          sx={{
            width: { xs: selected ? 0 : '100%', md: 340 },
            display: { xs: selected ? 'none' : 'block', md: 'block' },
            borderRight: '1px solid', borderColor: 'divider', overflowY: 'auto', flexShrink: 0,
          }}
        >
          {convos.length === 0 && (
            <Typography color="text.secondary" sx={{ p: 3, textAlign: 'center' }}>
              Todavía no hay conversaciones.
            </Typography>
          )}
          {convos.map((c) => (
            <Box
              key={c.id}
              onClick={() => openConvo(c)}
              sx={{
                p: 1.5, cursor: 'pointer', borderBottom: '1px solid', borderColor: 'divider',
                ...flowBg(c.flow, selected?.id === c.id),
                '&:hover': { filter: 'brightness(0.97)' },
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                <Typography fontWeight={700} noWrap>{c.contactName || c.phone}</Typography>
                <Badge color="success" badgeContent={c.unread} />
              </Box>
              <Typography variant="body2" color="text.secondary" noWrap>{preview(c)}</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5, gap: 1 }}>
                <Typography variant="caption" color="text.secondary" noWrap>{fmtTime(c.lastMessageAt)}</Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {c.addonOf && <Chip size="small" color="warning" label={`agregado #${c.addonOf}`} sx={{ height: 18 }} />}
                  {c.flow === 'ready' && <Chip size="small" color="success" label="pedido listo" sx={{ height: 18 }} />}
                  {c.flow === 'needs_human' && !c.addonOf && <Chip size="small" color="error" label="atención" sx={{ height: 18 }} />}
                  {c.botPaused && c.flow !== 'needs_human' && <Chip size="small" color="warning" variant="outlined" label="a mano" sx={{ height: 18 }} />}
                </Box>
              </Box>
            </Box>
          ))}
        </Box>

        {/* Hilo */}
        <Box sx={{ flex: 1, display: selected ? 'flex' : { xs: 'none', md: 'flex' }, flexDirection: 'column', minWidth: 0 }}>
          {!selected ? (
            <Box sx={{ m: 'auto', color: 'text.secondary' }}>Elegí una conversación</Box>
          ) : (
            <>
              {/* Header del hilo (coloreado según estado) */}
              <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1, ...flowBg(threadFlow, false) }}>
                <IconButton size="small" sx={{ display: { md: 'none' } }} onClick={() => setSelected(null)}>
                  <ArrowBackIcon />
                </IconButton>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {nameDraft !== null ? (
                    <TextField
                      size="small"
                      autoFocus
                      value={nameDraft}
                      placeholder="Nombre del cliente"
                      onChange={(e) => setNameDraft(e.target.value)}
                      onBlur={saveName}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveName();
                        if (e.key === 'Escape') setNameDraft(null);
                      }}
                      sx={{ maxWidth: 260 }}
                    />
                  ) : (
                    <Typography
                      fontWeight={700}
                      noWrap
                      onClick={() => setNameDraft(selected.contactName || '')}
                      sx={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}
                      title="Editar nombre"
                    >
                      {selected.contactName || selected.phone}
                      <EditIcon sx={{ fontSize: 14, opacity: 0.5 }} />
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary" display="block">{selected.phone}</Typography>
                </Box>
                {/* Botón para tomar el pedido/agregado (aparece cuando hay pedido armado). */}
                {readyOrder && (
                  <Button
                    variant="contained"
                    color={addonOf ? 'warning' : 'success'}
                    size="small"
                    startIcon={addonOf ? <AddShoppingCartIcon /> : <ReceiptLongIcon />}
                    onClick={() => setTakeOpen(true)}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    {takeLabel}
                  </Button>
                )}
                <Button
                  size="small"
                  color="inherit"
                  disabled={clearing}
                  onClick={clearThread}
                  startIcon={<DeleteSweepIcon />}
                  sx={{ whiteSpace: 'nowrap', textTransform: 'none', opacity: 0.75 }}
                  title="Borra el hilo para volver a probar desde cero"
                >
                  Limpiar
                </Button>
                <FormControlLabel
                  sx={{ mr: 0 }}
                  control={<Switch size="small" checked={selected.botPaused} onChange={toggleBot} />}
                  label={<Typography variant="body2">{selected.botPaused ? 'A mano' : 'Bot activo'}</Typography>}
                />
              </Box>

              {threadFlow === 'needs_human' && (
                <Box sx={{ px: 2, py: 1, bgcolor: RED, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="body2" color="error.main" fontWeight={700}>
                    🔴 Atención: {humanReason || 'el bot no pudo seguir'}
                  </Typography>
                  <Typography variant="caption" color="error.main">
                    {readyOrder
                      ? addonOf
                        ? `Revisá el agregado al #${addonOf} y tomalo.`
                        : 'Poné el precio del extra con "Editar" y tomá el pedido (no hace falta reactivar el bot).'
                      : 'Respondé la consulta a mano y reactivá el bot para que siga tomando el pedido.'}
                  </Typography>
                </Box>
              )}

              {/* Mensajes */}
              <Box ref={threadRef} sx={{ flex: 1, overflowY: 'auto', p: 2, bgcolor: 'grey.50', display: 'flex', flexDirection: 'column', gap: 1 }}>
                {messages.map((m) => (
                  <Box
                    key={m.id}
                    sx={{
                      alignSelf: m.direction === 'OUT' ? 'flex-end' : 'flex-start',
                      maxWidth: '75%',
                      bgcolor: m.direction === 'OUT' ? 'success.light' : 'background.paper',
                      border: '1px solid', borderColor: 'divider', borderRadius: 2, px: 1.5, py: 0.75,
                    }}
                  >
                    {m.type === 'image' ? (
                      <Typography variant="body2">📷 {m.mediaUrl ? 'Imagen (comprobante)' : 'Imagen'}</Typography>
                    ) : (
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{m.body}</Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'right' }}>
                      {fmtTime(m.createdAt)}{m.direction === 'OUT' && m.status === 'failed' ? ' · no enviado' : ''}
                    </Typography>
                  </Box>
                ))}
                {messages.length === 0 && <Typography color="text.secondary" sx={{ m: 'auto' }}>Sin mensajes</Typography>}
              </Box>

              <Divider />
              {/* Responder */}
              <Box sx={{ p: 1.5, display: 'flex', gap: 1, alignItems: 'flex-end' }}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Escribí un mensaje…"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendReply(); } }}
                  multiline
                  maxRows={4}
                />
                <Button variant="contained" onClick={sendReply} disabled={sending || !reply.trim()} sx={{ minWidth: 0, px: 2 }}>
                  <SendIcon fontSize="small" />
                </Button>
              </Box>
            </>
          )}
        </Box>
      </Paper>

      <OrderReviewDialog
        open={takeOpen}
        onClose={() => setTakeOpen(false)}
        conversationId={selected?.id ?? null}
        readyOrder={readyOrder}
        addonOf={addonOf}
        onTaken={onTaken}
        onEdited={onEdited}
      />
    </Box>
  );
}
