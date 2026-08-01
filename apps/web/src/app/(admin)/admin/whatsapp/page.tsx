'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
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
import { useSnackbar } from '@/app/snackbar-context';

interface Convo {
  id: string;
  phone: string;
  contactName: string | null;
  botPaused: boolean;
  unread: number;
  lastMessageAt: string | null;
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

export default function WhatsAppInboxPage() {
  const { showError } = useSnackbar();
  const [convos, setConvos] = useState<Convo[]>([]);
  const [selected, setSelected] = useState<Convo | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
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
      .then((d) => setMessages(d.data || []))
      .catch(() => {});
  }, []);

  useEffect(() => { loadConvos(); }, [loadConvos]);
  // Refresco de la lista y del hilo abierto.
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
    loadMessages(c.id);
    // Marcada como leída al abrir (el GET la resetea); reflejamos local.
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
    } catch {
      showError('No se pudo cambiar el modo');
    }
  };

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>WhatsApp</Typography>
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
                bgcolor: selected?.id === c.id ? 'action.selected' : 'transparent',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
                <Typography fontWeight={700} noWrap>{c.contactName || c.phone}</Typography>
                <Badge color="success" badgeContent={c.unread} />
              </Box>
              <Typography variant="body2" color="text.secondary" noWrap>{preview(c)}</Typography>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
                <Typography variant="caption" color="text.secondary">{fmtTime(c.lastMessageAt)}</Typography>
                {c.botPaused && <Chip size="small" color="warning" label="a mano" sx={{ height: 18 }} />}
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
              {/* Header del hilo */}
              <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton size="small" sx={{ display: { md: 'none' } }} onClick={() => setSelected(null)}>
                  <ArrowBackIcon />
                </IconButton>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography fontWeight={700} noWrap>{selected.contactName || selected.phone}</Typography>
                  <Typography variant="caption" color="text.secondary">{selected.phone}</Typography>
                </Box>
                <FormControlLabel
                  sx={{ mr: 0 }}
                  control={<Switch size="small" checked={selected.botPaused} onChange={toggleBot} />}
                  label={<Typography variant="body2">{selected.botPaused ? 'Atendido a mano' : 'Bot activo'}</Typography>}
                />
              </Box>

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
    </Box>
  );
}
