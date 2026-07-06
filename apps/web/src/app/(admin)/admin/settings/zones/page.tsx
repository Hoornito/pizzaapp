'use client';

import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Switch from '@mui/material/Switch';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useSnackbar } from '@/app/snackbar-context';

export default function DeliveryZonesPage() {
  const { showSuccess, showError } = useSnackbar();
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<any>(null);
  const [form, setForm] = useState({ name: '', radiusKm: 5, available: true });

  const loadZones = () => {
    fetch('/api/settings/zones')
      .then((r) => r.json())
      .then((d) => setZones(d.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadZones(); }, []);

  const openDialog = (zone?: any) => {
    setEditingZone(zone || null);
    setForm(zone
      ? { name: zone.name, radiusKm: zone.radiusKm, available: zone.available }
      : { name: '', radiusKm: 5, available: true }
    );
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const url = editingZone ? `/api/settings/zones/${editingZone.id}` : '/api/settings/zones';
    const method = editingZone ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        showError(json.error || 'Error al guardar');
        return;
      }
      showSuccess(editingZone ? 'Zona actualizada' : 'Zona creada');
      setDialogOpen(false);
      loadZones();
    } catch {
      showError('Error de conexión');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta zona?')) return;
    const res = await fetch(`/api/settings/zones/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setZones((prev) => prev.filter((z) => z.id !== id));
      showSuccess('Zona eliminada');
    } else {
      showError('Error al eliminar');
    }
  };

  if (loading) return <LoadingSpinner message="Cargando zonas..." />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Zonas de delivery</Typography>
          <Typography color="text.secondary">Definí las zonas de cobertura por radio</Typography>
        </Box>
        <Button variant="contained" onClick={() => openDialog()}>+ Nueva zona</Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell><strong>Zona</strong></TableCell>
              <TableCell align="center"><strong>Radio (km)</strong></TableCell>
              <TableCell align="center"><strong>Activa</strong></TableCell>
              <TableCell align="center"><strong>Tarifas</strong></TableCell>
              <TableCell><strong>Acciones</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {zones.map((zone) => (
              <TableRow key={zone.id} hover>
                <TableCell><Typography fontWeight={500}>{zone.name}</Typography></TableCell>
                <TableCell align="center">{zone.radiusKm} km</TableCell>
                <TableCell align="center">
                  <Switch checked={zone.available} size="small" disabled />
                </TableCell>
                <TableCell align="center">{zone.deliveryFees?.length || 0}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" onClick={() => openDialog(zone)}>Editar</Button>
                    <Button size="small" color="error" onClick={() => handleDelete(zone.id)}>Eliminar</Button>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingZone ? 'Editar zona' : 'Nueva zona de delivery'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Nombre *"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Radio de cobertura (km)"
              type="number"
              inputProps={{ min: 0, step: 0.5 }}
              value={form.radiusKm}
              onChange={(e) => setForm((p) => ({ ...p, radiusKm: Number(e.target.value) }))}
              fullWidth
            />
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Switch
                checked={form.available}
                onChange={(e) => setForm((p) => ({ ...p, available: e.target.checked }))}
              />
              <Typography>Zona activa</Typography>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.name}>Guardar</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
