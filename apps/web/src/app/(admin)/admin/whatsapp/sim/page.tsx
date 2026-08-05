'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import SendIcon from '@mui/icons-material/Send';
import EditNoteIcon from '@mui/icons-material/EditNote';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PowerSettingsNewIcon from '@mui/icons-material/PowerSettingsNew';
import { useSnackbar } from '@/app/snackbar-context';
import OrderReviewDialog, { type ReadyOrder } from '../OrderReviewDialog';

type Flow = 'normal' | 'ready' | 'needs_human';
interface Msg { id: string; direction: 'IN' | 'OUT'; type: string; body: string | null; status: string | null; sentById: string | null; createdAt: string }

const fmtTime = (d: string) => new Date(d).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

const GREEN = 'rgba(46,125,50,0.16)';
const RED = 'rgba(211,47,47,0.14)';
const flowBg = (flow: Flow) => (flow === 'ready' ? GREEN : flow === 'needs_human' ? RED : 'transparent');

interface View { id?: string; data?: Msg[]; flow?: Flow; readyOrder?: ReadyOrder | null; addonOf?: string | null; humanReason?: string | null; botPaused?: boolean }

export default function WhatsAppSimPage() {
  const { showError, showSuccess } = useSnackbar();
  const [phone, setPhone] = useState('+5491155550000');
  const [convoId, setConvoId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [flow, setFlow] = useState<Flow>('normal');
  const [readyOrder, setReadyOrder] = useState<ReadyOrder | null>(null);
  const [addonOf, setAddonOf] = useState<string | null>(null);
  const [humanReason, setHumanReason] = useState<string | null>(null);
  const [botPaused, setBotPaused] = useState(false);
  const [sender, setSender] = useState<'cliente' | 'local'>('cliente');
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [takeOpen, setTakeOpen] = useState(false);
  const [aiDisabled, setAiDisabled] = useState(false);
  // Corrección en curso: mensaje del bot que estamos corrigiendo.
  // Proveedor de IA con el que responde ESTE chat (para comparar Claude vs Gemini).
  const [providers, setProviders] = useState<{ id: string; model: string }[]>([]);
  const [provider, setProvider] = useState<string>('');
  const [correcting, setCorrecting] = useState<Msg | null>(null);
  const [goodReply, setGoodReply] = useState('');
  const [why, setWhy] = useState('');
  const [savingFix, setSavingFix] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight }); }, [messages]);
  useEffect(() => {
    fetch('/api/admin/whatsapp/ai', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        setAiDisabled(!!d.disabled);
        setProviders(d.providers || []);
        setProvider(d.defaultProvider || '');
      })
      .catch(() => {});
  }, []);

  const applyView = (d: View) => {
    if (d.id) setConvoId(d.id);
    setMessages(d.data || []);
    setFlow((d.flow as Flow) || 'normal');
    setReadyOrder(d.readyOrder || null);
    setAddonOf(d.addonOf || null);
    setHumanReason(d.humanReason || null);
    if (typeof d.botPaused === 'boolean') setBotPaused(d.botPaused);
  };

  const refresh = async (id = convoId) => {
    if (!id) return;
    const r = await fetch(`/api/admin/whatsapp/conversations/${id}`, { cache: 'no-store' });
    if (r.ok) applyView(await r.json());
  };

  const send = async () => {
    const text = input.trim();
    if (!text) return;
    setBusy(true);
    try {
      if (sender === 'cliente') {
        const r = await fetch('/api/admin/whatsapp/sim', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone: phone.trim(), text, provider: provider || undefined }),
        });
        const d = await r.json();
        if (!r.ok) { showError(d.error || 'Error en el simulador'); return; }
        applyView(d);
      } else {
        if (!convoId) { showError('Primero mandá un mensaje como cliente.'); return; }
        const r = await fetch(`/api/admin/whatsapp/conversations/${convoId}/reply`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });
        const d = await r.json();
        if (!r.ok) { showError(d.error || 'Error al responder'); return; }
        await refresh();
      }
      setInput('');
    } catch {
      showError('Error de conexión');
    } finally {
      setBusy(false);
    }
  };

  const toggleBot = async () => {
    if (!convoId) { showError('Primero mandá un mensaje como cliente.'); return; }
    const paused = !botPaused;
    setBusy(true);
    try {
      await fetch(`/api/admin/whatsapp/conversations/${convoId}/bot`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused }),
      });
      setBotPaused(paused);
      // Reactivar la IA hace que retome el pedido: refrescamos con un pequeño delay.
      if (!paused) setTimeout(() => refresh(), 900);
    } finally {
      setBusy(false);
    }
  };

  const toggleGlobalAI = async () => {
    const disabled = !aiDisabled;
    try {
      await fetch('/api/admin/whatsapp/ai', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disabled }),
      });
      setAiDisabled(disabled);
      showSuccess(disabled ? 'IA apagada en todos los chats' : 'IA reactivada');
    } catch {
      showError('No se pudo cambiar la IA global');
    }
  };

  const reset = async () => {
    setBusy(true);
    try {
      await fetch('/api/admin/whatsapp/sim/reset', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phone.trim() }),
      });
      setConvoId(null); setMessages([]); setFlow('normal'); setReadyOrder(null); setAddonOf(null); setHumanReason(null); setBotPaused(false); setSender('cliente');
    } finally {
      setBusy(false);
    }
  };

  // ─── Corregir una respuesta del bot ──────────────────────────────────────
  const openCorrection = (m: Msg) => {
    setCorrecting(m);
    setGoodReply('');
    setWhy('');
  };

  /** Turnos previos a ese mensaje: es el contexto que llevó a la respuesta mala. */
  const contextFor = (m: Msg) => {
    const idx = messages.findIndex((x) => x.id === m.id);
    return messages
      .slice(0, idx < 0 ? messages.length : idx)
      .filter((x) => (x.body ?? '').trim())
      .map((x) => ({ role: x.direction === 'IN' ? ('user' as const) : ('assistant' as const), text: x.body! }));
  };

  const saveCorrection = async () => {
    if (!correcting || !goodReply.trim()) return;
    setSavingFix(true);
    try {
      const r = await fetch('/api/admin/whatsapp/corrections', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: convoId,
          context: contextFor(correcting),
          badReply: correcting.body ?? '',
          goodReply: goodReply.trim(),
          note: why.trim() || null,
        }),
      });
      const d = await r.json();
      if (!r.ok) { showError(d.error || 'No se pudo guardar la corrección'); return; }
      setCorrecting(null);
      showSuccess('Corrección guardada — el bot ya la tiene en cuenta');
    } catch {
      showError('Error de conexión');
    } finally {
      setSavingFix(false);
    }
  };

  const onTaken = (orderNumber: string) => {
    showSuccess(`Pedido #${orderNumber} enviado a Pedidos ✅`);
    setTakeOpen(false);
    refresh();
    setTimeout(() => refresh(), 700);
  };
  const onEdited = (d: { readyOrder?: ReadyOrder | null; flow?: string; addonOf?: string | null; humanReason?: string | null }) => {
    setReadyOrder(d.readyOrder || null);
    if (d.flow) setFlow(d.flow as Flow);
    setAddonOf(d.addonOf || null);
    setHumanReason(d.humanReason || null);
    refresh();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
        <SmartToyIcon color="primary" />
        <Typography variant="h4" fontWeight={700}>Simulador de pedidos</Typography>
        <Chip size="small" label="local" color="warning" variant="outlined" />
        {aiDisabled && <Chip size="small" label="IA apagada (global)" color="error" />}
        <Box sx={{ flex: 1 }} />
        <Button component={Link} href="/admin/whatsapp/bot" size="small" variant="outlined" startIcon={<AutoFixHighIcon />}>
          Entrenar al bot
        </Button>
        <Button onClick={toggleGlobalAI} variant={aiDisabled ? 'contained' : 'outlined'} color={aiDisabled ? 'error' : 'inherit'} size="small" startIcon={<PowerSettingsNewIcon />}>
          {aiDisabled ? 'Reactivar IA' : 'Apagar IA (global)'}
        </Button>
        <Button component={Link} href="/admin/whatsapp" startIcon={<ArrowBackIcon />} size="small">Volver al inbox</Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Escribí como si fueras el cliente y mirá cómo la IA arma el pedido. No hace falta ningún número de WhatsApp
        (las respuestas no salen a ningún lado, quedan acá). Necesita la <b>API key de Anthropic</b> configurada.
        {' '}Si una respuesta del bot no te gusta, tocá el ✎ al lado de <b>Bot</b> y decile qué tendría que haber dicho.
      </Typography>

      <Paper variant="outlined" sx={{ p: 1.5, mb: 2, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField label="Teléfono de prueba" size="small" value={phone} onChange={(e) => setPhone(e.target.value)} sx={{ width: 200 }} />
        <Button variant="outlined" color="secondary" startIcon={<RestartAltIcon />} onClick={reset} disabled={busy}>
          Reiniciar chat
        </Button>
        <FormControlLabel
          control={<Switch size="small" checked={botPaused} onChange={toggleBot} disabled={busy || !convoId} />}
          label={<Typography variant="body2">{botPaused ? 'Bot a mano' : 'Bot activo'}</Typography>}
        />
        {providers.length > 1 && (
          <Tooltip title="Con qué IA responde este chat. Para comparar en serio, reiniciá el chat y repetí el mismo pedido con la otra.">
            <ToggleButtonGroup
              size="small" exclusive value={provider}
              onChange={(_e, v) => v && setProvider(v)}
              disabled={busy}
            >
              {providers.map((p) => (
                <ToggleButton key={p.id} value={p.id} sx={{ textTransform: 'none', px: 1.25 }}>
                  {p.id === 'gemini' ? 'Gemini' : 'Claude'}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Tooltip>
        )}
        <Box sx={{ flex: 1 }} />
        {providers.length > 0 && (
          <Chip
            size="small" variant="outlined"
            label={providers.find((p) => p.id === provider)?.model || provider}
          />
        )}
        {flow === 'ready' && <Chip color="success" label="🟢 Pedido listo" />}
        {flow === 'needs_human' && <Chip color="error" label={addonOf ? `🔴 Agregado #${addonOf}` : '🔴 Necesita una persona'} />}
      </Paper>

      <Paper variant="outlined" sx={{ display: 'flex', flexDirection: 'column', height: '62vh', overflow: 'hidden' }}>
        {/* Barra de acciones (coloreada según estado) */}
        <Box sx={{ p: 1, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', gap: 1, alignItems: 'center', minHeight: 52, bgcolor: flowBg(flow) }}>
          {readyOrder && (
            <Button
              variant="contained"
              color={addonOf ? 'warning' : 'success'}
              size="small"
              startIcon={addonOf ? <AddShoppingCartIcon /> : <ReceiptLongIcon />}
              onClick={() => setTakeOpen(true)}
            >
              {addonOf ? `Tomar agregado #${addonOf}` : 'Tomar pedido'}
            </Button>
          )}
          {flow === 'needs_human' && (
            <Box>
              <Typography variant="caption" color="error.main" fontWeight={700} sx={{ display: 'block' }}>
                🔴 {humanReason || 'El bot no pudo seguir'}
              </Typography>
              <Typography variant="caption" color="error.main">
                {readyOrder
                  ? addonOf
                    ? `Revisá el agregado al #${addonOf} y tomalo.`
                    : 'Poné el precio del extra con "Editar" y tomá el pedido.'
                  : 'Respondé como Local y reactivá el bot para que siga.'}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Hilo */}
        <Box ref={threadRef} sx={{ flex: 1, overflowY: 'auto', p: 2, bgcolor: 'grey.50', display: 'flex', flexDirection: 'column', gap: 1 }}>
          {messages.length === 0 && <Typography color="text.secondary" sx={{ m: 'auto' }}>Mandá el primer mensaje como cliente 👇</Typography>}
          {messages.map((m) => {
            const isCustomer = m.direction === 'IN';
            const isBot = !isCustomer && !m.sentById;
            const who = isCustomer ? 'Cliente' : m.sentById ? 'Local' : 'Bot';
            return (
              <Box key={m.id} sx={{ alignSelf: isCustomer ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, px: 0.5, justifyContent: isCustomer ? 'flex-end' : 'flex-start' }}>
                  <Typography variant="caption" color="text.secondary">{who}</Typography>
                  {isBot && (
                    <Tooltip title="Corregir esta respuesta">
                      <IconButton size="small" sx={{ p: 0.25 }} onClick={() => openCorrection(m)}>
                        <EditNoteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
                <Box sx={{
                  bgcolor: isCustomer ? 'primary.light' : m.sentById ? 'warning.light' : 'background.paper',
                  border: '1px solid', borderColor: 'divider', borderRadius: 2, px: 1.5, py: 0.75,
                }}>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{m.body}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'right' }}>{fmtTime(m.createdAt)}</Typography>
                </Box>
              </Box>
            );
          })}
        </Box>

        <Divider />
        {/* Enviar */}
        <Box sx={{ p: 1.5, display: 'flex', gap: 1, alignItems: 'flex-end' }}>
          <ToggleButtonGroup size="small" exclusive value={sender} onChange={(_e, v) => v && setSender(v)} sx={{ flexShrink: 0 }}>
            <ToggleButton value="cliente">Cliente</ToggleButton>
            <ToggleButton value="local">Local</ToggleButton>
          </ToggleButtonGroup>
          <TextField
            fullWidth size="small"
            placeholder={sender === 'cliente' ? 'Escribí como cliente…' : 'Respuesta del local…'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            multiline maxRows={4}
          />
          <Button variant="contained" onClick={send} disabled={busy || !input.trim()} sx={{ minWidth: 0, px: 2 }}>
            <SendIcon fontSize="small" />
          </Button>
        </Box>
      </Paper>

      {/* Corregir una respuesta del bot */}
      <Dialog open={!!correcting} onClose={() => !savingFix && setCorrecting(null)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Corregir respuesta
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Se guarda con el contexto del chat. El bot la usa como ejemplo desde el próximo mensaje.
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          <Typography variant="caption" color="text.secondary">El bot respondió:</Typography>
          <Box sx={{ bgcolor: 'grey.100', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1, mb: 2 }}>
            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{correcting?.body}</Typography>
          </Box>
          <TextField
            label="¿Qué tendría que haber respondido?"
            value={goodReply}
            onChange={(e) => setGoodReply(e.target.value)}
            fullWidth multiline minRows={3} autoFocus
            placeholder="Escribilo como se lo dirías vos al cliente…"
          />
          <TextField
            label="¿Por qué estaba mal? (opcional)"
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            fullWidth size="small" sx={{ mt: 2 }}
            placeholder="Ej: se fue de largo, tiene que ser una sola oración"
            helperText="Ayuda mucho al destilar: es la regla que se va a escribir en las instrucciones."
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCorrecting(null)} disabled={savingFix}>Cancelar</Button>
          <Button variant="contained" onClick={saveCorrection} disabled={savingFix || !goodReply.trim()}>
            Guardar corrección
          </Button>
        </DialogActions>
      </Dialog>

      <OrderReviewDialog
        open={takeOpen}
        onClose={() => setTakeOpen(false)}
        conversationId={convoId}
        readyOrder={readyOrder}
        addonOf={addonOf}
        onTaken={onTaken}
        onEdited={onEdited}
      />
    </Box>
  );
}
