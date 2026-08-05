'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import SaveIcon from '@mui/icons-material/Save';
import HistoryIcon from '@mui/icons-material/History';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RestoreIcon from '@mui/icons-material/Restore';
import { useSnackbar } from '@/app/snackbar-context';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { diffLines, diffStats, type DiffLine } from './diff';

interface Version {
  id: string;
  version: number;
  content: string;
  source: string;
  note: string | null;
  createdAt: string;
}
interface Correction {
  id: string;
  context: { role: 'user' | 'assistant'; text: string }[];
  badReply: string;
  goodReply: string;
  note: string | null;
  createdAt: string;
}

const fmtDate = (d: string) =>
  new Date(d).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const SOURCE_LABEL: Record<string, string> = {
  seed: 'inicial',
  manual: 'a mano',
  destilado: 'destilado',
};

export default function BotInstructionsPage() {
  const { showError, showSuccess } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Version | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const [distilling, setDistilling] = useState(false);
  const [proposal, setProposal] = useState<{ current: string; proposed: string; basedOn: number } | null>(null);
  const [applying, setApplying] = useState(false);

  const [viewing, setViewing] = useState<Version | null>(null);

  const dirty = active ? draft.trim() !== active.content.trim() : draft.trim().length > 0;

  const load = useCallback(async () => {
    try {
      const [ri, rc] = await Promise.all([
        fetch('/api/admin/whatsapp/instructions', { cache: 'no-store' }),
        fetch('/api/admin/whatsapp/corrections', { cache: 'no-store' }),
      ]);
      const di = await ri.json();
      const dc = await rc.json();
      if (!ri.ok) { showError(di.error || 'No se pudieron cargar las instrucciones'); return; }
      setActive(di.active || null);
      setVersions(di.versions || []);
      setDraft(di.active?.content || '');
      setCorrections(dc.data || []);
    } catch {
      showError('Error de conexión');
    } finally {
      setLoading(false);
    }
  }, [showError]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const r = await fetch('/api/admin/whatsapp/instructions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: draft }),
      });
      const d = await r.json();
      if (!r.ok) { showError(d.error || 'No se pudo guardar'); return; }
      setActive(d.active); setVersions(d.versions); setDraft(d.active.content);
      showSuccess(`Guardado como v${d.active.version} — el bot ya lo está usando`);
    } catch {
      showError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const restore = async (version: number) => {
    if (!confirm(`¿Restaurar la v${version}? Se guarda como una versión nueva; no se pierde nada.`)) return;
    setSaving(true);
    try {
      const r = await fetch('/api/admin/whatsapp/instructions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ restoreVersion: version }),
      });
      const d = await r.json();
      if (!r.ok) { showError(d.error || 'No se pudo restaurar'); return; }
      setActive(d.active); setVersions(d.versions); setDraft(d.active.content);
      setViewing(null);
      showSuccess(`Restaurada la v${version} (ahora es la v${d.active.version})`);
    } finally {
      setSaving(false);
    }
  };

  const distill = async () => {
    setDistilling(true);
    try {
      const r = await fetch('/api/admin/whatsapp/corrections/distill', { method: 'POST' });
      const d = await r.json();
      if (!r.ok) { showError(d.error || 'No se pudo destilar'); return; }
      setProposal({ current: d.current, proposed: d.proposed, basedOn: d.basedOn });
    } catch {
      showError('Error de conexión');
    } finally {
      setDistilling(false);
    }
  };

  const applyProposal = async () => {
    if (!proposal) return;
    setApplying(true);
    try {
      const r = await fetch('/api/admin/whatsapp/corrections/distill', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: proposal.proposed }),
      });
      const d = await r.json();
      if (!r.ok) { showError(d.error || 'No se pudo aplicar'); return; }
      setActive(d.active); setVersions(d.versions); setDraft(d.active.content);
      setCorrections([]);
      setProposal(null);
      showSuccess(`Aplicado como v${d.active.version} · ${d.applied} correcciones absorbidas`);
    } finally {
      setApplying(false);
    }
  };

  const removeCorrection = async (id: string) => {
    const r = await fetch(`/api/admin/whatsapp/corrections/${id}`, { method: 'DELETE' });
    if (r.ok) setCorrections((prev) => prev.filter((c) => c.id !== id));
    else showError('No se pudo borrar');
  };

  if (loading) return <LoadingSpinner message="Cargando instrucciones..." />;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
        <AutoFixHighIcon color="primary" />
        <Typography variant="h4" fontWeight={700}>Entrenar al bot</Typography>
        {active && <Chip size="small" label={`v${active.version} activa`} color="primary" variant="outlined" />}
        <Box sx={{ flex: 1 }} />
        <Button component={Link} href="/admin/whatsapp/sim" size="small" variant="outlined">Ir al simulador</Button>
        <Button component={Link} href="/admin/whatsapp" startIcon={<ArrowBackIcon />} size="small">Volver al inbox</Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Estas son las instrucciones que sigue el bot al tomar pedidos. Editalas a mano y guardá, o corregí sus
        respuestas en el simulador y después usá <b>Destilar</b> para que la IA las incorpore sola. Cada guardado
        crea una versión nueva: siempre podés volver atrás.
      </Typography>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '1fr 360px' }, gap: 2, alignItems: 'start' }}>
        {/* Editor */}
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <Typography variant="subtitle2" fontWeight={700}>Instrucciones</Typography>
            {dirty && <Chip size="small" label="sin guardar" color="warning" />}
            <Box sx={{ flex: 1 }} />
            <Button
              variant="contained" size="small" startIcon={<SaveIcon />}
              onClick={save} disabled={!dirty || saving}
            >
              Guardar
            </Button>
          </Box>
          <TextField
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            multiline minRows={24} fullWidth
            placeholder="# Instrucciones del bot…"
            inputProps={{ style: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13, lineHeight: 1.5 } }}
          />
          <Typography variant="caption" color="text.secondary">
            No pongas acá el menú ni los precios: el bot los saca de la base de datos.
          </Typography>
        </Paper>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Correcciones */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle2" fontWeight={700}>Correcciones pendientes</Typography>
              <Chip size="small" label={corrections.length} color={corrections.length ? 'warning' : 'default'} />
            </Box>
            {corrections.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                Ninguna. Corregí respuestas del bot desde el simulador y van a aparecer acá.
              </Typography>
            ) : (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  El bot ya las está usando como ejemplos. Destilarlas las convierte en reglas fijas.
                </Typography>
                <Box sx={{ maxHeight: 280, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {corrections.map((c) => (
                    <Box key={c.id} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.5 }}>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="caption" color="error.main" sx={{ display: 'block' }}>
                            ✗ {c.badReply || '(sin respuesta)'}
                          </Typography>
                          <Typography variant="caption" color="success.main" sx={{ display: 'block' }}>
                            ✓ {c.goodReply}
                          </Typography>
                          {c.note && (
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontStyle: 'italic' }}>
                              {c.note}
                            </Typography>
                          )}
                        </Box>
                        <IconButton size="small" onClick={() => removeCorrection(c.id)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  ))}
                </Box>
                <Button
                  fullWidth variant="contained" color="secondary" sx={{ mt: 1.5 }}
                  startIcon={distilling ? <CircularProgress size={16} color="inherit" /> : <AutoFixHighIcon />}
                  onClick={distill} disabled={distilling}
                >
                  {distilling ? 'Pensando…' : `Destilar ${corrections.length} correcciones`}
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                  Vas a ver el cambio propuesto antes de aplicarlo.
                </Typography>
              </>
            )}
          </Paper>

          {/* Historial */}
          <Paper variant="outlined" sx={{ p: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <HistoryIcon fontSize="small" color="action" />
              <Typography variant="subtitle2" fontWeight={700}>Historial</Typography>
            </Box>
            <Box sx={{ maxHeight: 320, overflowY: 'auto' }}>
              {versions.map((v) => (
                <Box
                  key={v.id}
                  sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.75, borderBottom: '1px solid', borderColor: 'divider' }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={v.id === active?.id ? 700 : 400}>
                      v{v.version}
                      {v.id === active?.id && ' · activa'}
                      <Typography component="span" variant="caption" color="text.secondary">
                        {' '}({SOURCE_LABEL[v.source] || v.source})
                      </Typography>
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      {fmtDate(v.createdAt)}{v.note ? ` · ${v.note}` : ''}
                    </Typography>
                  </Box>
                  <Tooltip title="Ver esta versión">
                    <IconButton size="small" onClick={() => setViewing(v)}>
                      <HistoryIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {v.id !== active?.id && (
                    <Tooltip title="Restaurar">
                      <IconButton size="small" color="primary" onClick={() => restore(v.version)} disabled={saving}>
                        <RestoreIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              ))}
            </Box>
          </Paper>
        </Box>
      </Box>

      {/* Propuesta de la IA */}
      <Dialog open={!!proposal} onClose={() => !applying && setProposal(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          Cambio propuesto
          {proposal && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              A partir de {proposal.basedOn} correcci{proposal.basedOn === 1 ? 'ón' : 'ones'}. Revisalo antes de aplicar.
            </Typography>
          )}
        </DialogTitle>
        <DialogContent dividers>
          {proposal && <DiffView before={proposal.current} after={proposal.proposed} />}
          <Divider sx={{ my: 2 }} />
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Texto final (editable)</Typography>
          <TextField
            value={proposal?.proposed ?? ''}
            onChange={(e) => setProposal((p) => (p ? { ...p, proposed: e.target.value } : p))}
            multiline minRows={10} maxRows={20} fullWidth
            inputProps={{ style: { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 13 } }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setProposal(null)} disabled={applying}>Descartar</Button>
          <Button variant="contained" onClick={applyProposal} disabled={applying}>
            Aplicar y marcar correcciones
          </Button>
        </DialogActions>
      </Dialog>

      {/* Ver una versión vieja */}
      <Dialog open={!!viewing} onClose={() => setViewing(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          v{viewing?.version}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            {viewing && fmtDate(viewing.createdAt)}{viewing?.note ? ` · ${viewing.note}` : ''}
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          {viewing && active && viewing.id !== active.id ? (
            <>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>Diferencias contra la versión activa</Typography>
              <DiffView before={viewing.content} after={active.content} />
            </>
          ) : (
            <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', fontSize: 13, fontFamily: 'ui-monospace, monospace' }}>
              {viewing?.content}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewing(null)}>Cerrar</Button>
          {viewing && viewing.id !== active?.id && (
            <Button variant="contained" startIcon={<RestoreIcon />} onClick={() => restore(viewing.version)} disabled={saving}>
              Restaurar esta versión
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function DiffView({ before, after }: { before: string; after: string }) {
  const lines: DiffLine[] = useMemo(() => diffLines(before, after), [before, after]);
  const { added, removed } = useMemo(() => diffStats(lines), [lines]);

  if (!added && !removed) {
    return <Typography variant="body2" color="text.secondary">Sin cambios.</Typography>;
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
        <Chip size="small" color="success" variant="outlined" label={`+${added}`} />
        <Chip size="small" color="error" variant="outlined" label={`−${removed}`} />
      </Box>
      <Box
        sx={{
          border: '1px solid', borderColor: 'divider', borderRadius: 1,
          maxHeight: 320, overflow: 'auto',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12.5, lineHeight: 1.6,
        }}
      >
        {lines.map((l, i) => (
          <Box
            key={i}
            sx={{
              px: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
              bgcolor: l.type === 'add' ? 'rgba(46,125,50,0.13)' : l.type === 'del' ? 'rgba(211,47,47,0.12)' : 'transparent',
              color: l.type === 'ctx' ? 'text.secondary' : 'text.primary',
            }}
          >
            {l.type === 'add' ? '+ ' : l.type === 'del' ? '− ' : '  '}
            {l.text || ' '}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
