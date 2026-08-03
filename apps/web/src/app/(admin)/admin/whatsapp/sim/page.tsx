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
import SendIcon from '@mui/icons-material/Send';
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
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => { threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight }); }, [messages]);
  useEffect(() => {
    fetch('/api/admin/whatsapp/ai', { cache: 'no-store' }).then((r) => r.json()).then((d) => setAiDisabled(!!d.disabled)).catch(() => {});
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
          body: JSON.stringify({ phone: phone.trim(), text }),
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
        <Button onClick={toggleGlobalAI} variant={aiDisabled ? 'contained' : 'outlined'} color={aiDisabled ? 'error' : 'inherit'} size="small" startIcon={<PowerSettingsNewIcon />}>
          {aiDisabled ? 'Reactivar IA' : 'Apagar IA (global)'}
        </Button>
        <Button component={Link} href="/admin/whatsapp" startIcon={<ArrowBackIcon />} size="small">Volver al inbox</Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Escribí como si fueras el cliente y mirá cómo la IA arma el pedido. No hace falta ningún número de WhatsApp
        (las respuestas no salen a ningún lado, quedan acá). Necesita la <b>API key de Anthropic</b> configurada.
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
        <Box sx={{ flex: 1 }} />
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
            const who = isCustomer ? 'Cliente' : m.sentById ? 'Local' : 'Bot';
            return (
              <Box key={m.id} sx={{ alignSelf: isCustomer ? 'flex-end' : 'flex-start', maxWidth: '75%' }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: isCustomer ? 'right' : 'left', px: 0.5 }}>
                  {who}
                </Typography>
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
