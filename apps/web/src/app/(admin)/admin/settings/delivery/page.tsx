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
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import { formatCurrency } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useSnackbar } from '@/app/snackbar-context';

export default function DeliveryFeesPage() {
  const { showSuccess, showError } = useSnackbar();
  const [fees, setFees] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFee, setEditingFee] = useState<any>(null);
  const [form, setForm] = useState({
    shipmentZoneId: '',
    name: '',
    fee: 0,
    minOrderAmount: 0,
    isDefault: false,
  });

  const loadData = () => {
    Promise.all([
      fetch('/api/settings/delivery').then((r) => r.json()),
      fetch('/api/settings/zones').then((r) => r.json()),
    ]).then(([feesData, zonesData]) => {
      setFees(feesData.data || []);
      setZones(zonesData.data || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { loadData(); }, []);

  const openDialog = (fee?: any) => {
    setEditingFee(fee || null);
    setForm(fee
      ? {
          shipmentZoneId: fee.shipmentZoneId || '',
          name: fee.name,
          fee: Number(fee.fee),
          minOrderAmount: Number(fee.minOrderAmount || 0),
          isDefault: fee.isDefault,
        }
      : { shipmentZoneId: '', name: '', fee: 0, minOrderAmount: 0, isDefault: false }
    );
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const url = editingFee ? `/api/settings/delivery/${editingFee.id}` : '/api/settings/delivery';
    const method = editingFee ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          shipmentZoneId: form.shipmentZoneId || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showError(json.error || 'Error al guardar');
        return;
      }
      showSuccess(editingFee ? 'Tarifa actualizada' : 'Tarifa creada');
      setDialogOpen(false);
      loadData();
    } catch {
      showError('Error de conexión');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta tarifa?')) return;
    const res = await fetch(`/api/settings/delivery/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setFees((prev) => prev.filter((f) => f.id !== id));
      showSuccess('Tarifa eliminada');
    }
  };

  if (loading) return <LoadingSpinner message="Cargando tarifas..." />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Tarifas de delivery</Typography>
          <Typography color="text.secondary">Configurá el costo de envío por zona y monto mínimo</Typography>
        </Box>
        <Button variant="contained" onClick={() => openDialog()}>+ Nueva tarifa</Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell><strong>Nombre</strong></TableCell>
              <TableCell><strong>Zona</strong></TableCell>
              <TableCell align="right"><strong>Monto mínimo</strong></TableCell>
              <TableCell align="right"><strong>Costo de envío</strong></TableCell>
              <TableCell align="center"><strong>Default</strong></TableCell>
              <TableCell><strong>Acciones</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {fees.map((fee) => (
              <TableRow key={fee.id} hover>
                <TableCell><Typography fontWeight={500}>{fee.name}</Typography></TableCell>
                <TableCell>{fee.zone?.name || 'General'}</TableCell>
                <TableCell align="right">{formatCurrency(fee.minOrderAmount || 0)}</TableCell>
                <TableCell align="right">
                  {Number(fee.fee) === 0
                    ? <Typography color="success.main" fontWeight={600}>Gratis</Typography>
                    : formatCurrency(fee.fee)
                  }
                </TableCell>
                <TableCell align="center">{fee.isDefault ? '✅' : '—'}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" onClick={() => openDialog(fee)}>Editar</Button>
                    <Button size="small" color="error" onClick={() => handleDelete(fee.id)}>Eliminar</Button>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingFee ? 'Editar tarifa' : 'Nueva tarifa de delivery'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Nombre de la tarifa *"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              fullWidth
              placeholder="Ej: Zona centro, Delivery gratis..."
            />
            <FormControl fullWidth>
              <InputLabel>Zona (opcional)</InputLabel>
              <Select
                value={form.shipmentZoneId}
                label="Zona (opcional)"
                onChange={(e) => setForm((p) => ({ ...p, shipmentZoneId: e.target.value }))}
              >
                <MenuItem value="">Sin zona específica</MenuItem>
                {zones.map((z) => <MenuItem key={z.id} value={z.id}>{z.name}</MenuItem>)}
              </Select>
            </FormControl>
            <TextField
              label="Monto mínimo de pedido ($)"
              type="number"
              inputProps={{ min: 0, step: 1 }}
              value={form.minOrderAmount}
              onChange={(e) => setForm((p) => ({ ...p, minOrderAmount: Number(e.target.value) }))}
              fullWidth
            />
            <TextField
              label="Costo de envío ($) — 0 = gratis"
              type="number"
              inputProps={{ min: 0, step: 1 }}
              value={form.fee}
              onChange={(e) => setForm((p) => ({ ...p, fee: Number(e.target.value) }))}
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.isDefault}
                  onChange={(e) => setForm((p) => ({ ...p, isDefault: e.target.checked }))}
                />
              }
              label="Tarifa predeterminada"
            />
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
