'use client';

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useSnackbar } from '@/app/snackbar-context';

interface Area {
  id: string;
  name: string;
  blockedFrom: string | null;
  blockedTo: string | null;
  active: boolean;
}

const VACIO = { name: '', blockedFrom: '', blockedTo: '' };

/**
 * Barrios y countries de la zona con la franja en la que NO se reparte ahí
 * (al mediodía no se llega a los privados). El cliente escribe el barrio en el
 * campo de dirección y el pedido se rechaza si cae en esa franja.
 */
export default function DeliveryAreasPage() {
  const { showSuccess, showError } = useSnackbar();
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nuevo, setNuevo] = useState(VACIO);

  const load = () =>
    fetch('/api/settings/delivery-areas', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setAreas(d.data || []))
      .finally(() => setLoading(false));

  useEffect(() => { load(); }, []);

  const agregar = async () => {
    if (nuevo.name.trim().length < 2) { showError('Poné el nombre del barrio'); return; }
    setSaving(true);
    try {
      const res = await fetch('/api/settings/delivery-areas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...nuevo, active: true }),
      });
      const json = await res.json();
      if (!res.ok) { showError(json.error || 'No se pudo guardar'); return; }
      setNuevo(VACIO);
      await load();
      showSuccess('Barrio agregado');
    } finally {
      setSaving(false);
    }
  };

  const guardar = async (area: Area, patch: Partial<Area>) => {
    setSaving(true);
    try {
      const body = { ...area, ...patch };
      const res = await fetch(`/api/settings/delivery-areas/${area.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: body.name,
          blockedFrom: body.blockedFrom || '',
          blockedTo: body.blockedTo || '',
          active: body.active,
        }),
      });
      const json = await res.json();
      if (!res.ok) { showError(json.error || 'No se pudo guardar'); return; }
      await load();
    } finally {
      setSaving(false);
    }
  };

  const borrar = async (area: Area) => {
    if (!confirm(`¿Borrar ${area.name}?`)) return;
    await fetch(`/api/settings/delivery-areas/${area.id}`, { method: 'DELETE' });
    await load();
  };

  if (loading) return <LoadingSpinner message="Cargando zonas..." />;

  return (
    <Paper sx={{ p: 3, maxWidth: 780 }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>Zonas de reparto</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Barrios y countries con el horario en el que <strong>no</strong> se reparte ahí.
        El cliente escribe el barrio en la dirección; si el pedido cae en esa franja no lo dejamos
        confirmar y le ofrecemos programarlo o retirarlo. Sin horarios cargados, el barrio no bloquea nada.
      </Typography>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell><strong>Barrio</strong></TableCell>
            <TableCell align="center"><strong>No se reparte desde</strong></TableCell>
            <TableCell align="center"><strong>Hasta</strong></TableCell>
            <TableCell align="center"><strong>Activo</strong></TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {areas.map((a) => (
            <TableRow key={a.id}>
              <TableCell>
                <TextField
                  size="small"
                  defaultValue={a.name}
                  onBlur={(e) => e.target.value !== a.name && guardar(a, { name: e.target.value })}
                  sx={{ minWidth: 180 }}
                />
              </TableCell>
              <TableCell align="center">
                <TextField
                  size="small" type="time"
                  defaultValue={a.blockedFrom ?? ''}
                  onBlur={(e) => e.target.value !== (a.blockedFrom ?? '') && guardar(a, { blockedFrom: e.target.value })}
                  sx={{ width: 130 }}
                />
              </TableCell>
              <TableCell align="center">
                <TextField
                  size="small" type="time"
                  defaultValue={a.blockedTo ?? ''}
                  onBlur={(e) => e.target.value !== (a.blockedTo ?? '') && guardar(a, { blockedTo: e.target.value })}
                  sx={{ width: 130 }}
                />
              </TableCell>
              <TableCell align="center">
                <Switch
                  checked={a.active}
                  disabled={saving}
                  onChange={(e) => guardar(a, { active: e.target.checked })}
                />
              </TableCell>
              <TableCell align="right">
                <IconButton size="small" color="error" onClick={() => borrar(a)}>
                  <DeleteOutlineIcon fontSize="small" />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
          {areas.length === 0 && (
            <TableRow>
              <TableCell colSpan={5}>
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                  Todavía no cargaste ningún barrio.
                </Typography>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Box sx={{ display: 'flex', gap: 1.5, mt: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          size="small" label="Nombre del barrio" placeholder="Barrio Los Álamos"
          value={nuevo.name}
          onChange={(e) => setNuevo((p) => ({ ...p, name: e.target.value }))}
          sx={{ minWidth: 220 }}
        />
        <TextField
          size="small" type="time" label="No reparte desde" InputLabelProps={{ shrink: true }}
          value={nuevo.blockedFrom}
          onChange={(e) => setNuevo((p) => ({ ...p, blockedFrom: e.target.value }))}
          sx={{ width: 150 }}
        />
        <TextField
          size="small" type="time" label="Hasta" InputLabelProps={{ shrink: true }}
          value={nuevo.blockedTo}
          onChange={(e) => setNuevo((p) => ({ ...p, blockedTo: e.target.value }))}
          sx={{ width: 150 }}
        />
        <Button variant="contained" onClick={agregar} disabled={saving}>
          + Agregar barrio
        </Button>
      </Box>
    </Paper>
  );
}
