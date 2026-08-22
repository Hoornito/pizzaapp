'use client';

import { useCallback, useEffect, useState } from 'react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Divider from '@mui/material/Divider';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import PlaceOutlinedIcon from '@mui/icons-material/PlaceOutlined';
import { useSnackbar } from '@/app/snackbar-context';
import { DELIVERY_ZONE_LABEL } from '@/lib/constants';

type Address = {
  id: string;
  street: string;
  number: string;
  apartment: string | null;
  city: string;
  state: string | null;
  reference: string | null;
};

const formVacio = { street: '', number: '', apartment: '', city: '', state: '', reference: '' };

/**
 * Direcciones guardadas del cliente. Son las mismas que se le ofrecen en el
 * checkout: acá puede agregarlas o sacarlas sin tener que hacer un pedido.
 */
export function AddressBook() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState(formVacio);
  const [saving, setSaving] = useState(false);
  const { showSuccess, showError } = useSnackbar();

  const load = useCallback(() => {
    return fetch('/api/addresses')
      .then((r) => r.json())
      .then((d) => setAddresses(d.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const abrir = () => {
    setForm(formVacio);
    setDialog(true);
  };

  const guardar = async () => {
    if (!form.street.trim() || !form.number.trim() || !form.city.trim()) {
      showError('Completá calle, número y ciudad');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        showError(json.error || 'No pudimos guardar la dirección');
        return;
      }
      showSuccess('Dirección guardada');
      setDialog(false);
      await load();
    } catch {
      showError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const eliminar = async (a: Address) => {
    if (!confirm(`¿Quitar ${a.street} ${a.number} de tus direcciones?`)) return;
    try {
      const res = await fetch(`/api/addresses/${a.id}`, { method: 'DELETE' });
      if (!res.ok) {
        showError('No pudimos quitar la dirección');
        return;
      }
      showSuccess('Dirección eliminada');
      await load();
    } catch {
      showError('Error de conexión');
    }
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 1 }}>
        <Box>
          <Typography variant="h6" fontWeight={600}>
            Mis direcciones
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Las que te aparecen para elegir al hacer un pedido.
          </Typography>
        </Box>
        <Button variant="outlined" size="small" onClick={abrir} sx={{ flexShrink: 0 }}>
          Agregar
        </Button>
      </Box>

      {loading ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Cargando...
        </Typography>
      ) : addresses.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          Todavía no guardaste ninguna. Podés agregarla acá, o al hacer un pedido cuando te
          preguntemos si la querés guardar.
        </Typography>
      ) : (
        <Box sx={{ mt: 2 }}>
          {addresses.map((a, i) => (
            <Box key={a.id}>
              {i > 0 && <Divider />}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1.5 }}>
                <PlaceOutlinedIcon color="action" fontSize="small" />
                <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600}>
                    {a.street} {a.number}
                    {a.apartment ? `, ${a.apartment}` : ''}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {[a.city, a.state, a.reference].filter(Boolean).join(' · ')}
                  </Typography>
                </Box>
                <Tooltip title="Quitar">
                  <IconButton size="small" color="error" onClick={() => void eliminar(a)}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      <Dialog open={dialog} onClose={() => setDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Nueva dirección</DialogTitle>
        <DialogContent>
          {/* Mismos campos que el checkout: en la zona hay barrios cerrados que
              van con nombre de barrio y número de lote en vez de calle y altura. */}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Calle / Barrio cerrado *"
              value={form.street}
              onChange={(e) => setForm((p) => ({ ...p, street: e.target.value }))}
              fullWidth
            />
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
              <TextField
                label="Número / Nro de lote *"
                value={form.number}
                onChange={(e) => setForm((p) => ({ ...p, number: e.target.value }))}
              />
              <TextField
                label="Departamento"
                value={form.apartment}
                onChange={(e) => setForm((p) => ({ ...p, apartment: e.target.value }))}
              />
            </Box>
            <TextField
              label="Ciudad *"
              value={form.city}
              onChange={(e) => setForm((p) => ({ ...p, city: e.target.value }))}
              helperText={`Zona de reparto: ${DELIVERY_ZONE_LABEL} y alrededores`}
              fullWidth
            />
            <TextField
              label="Provincia"
              value={form.state}
              onChange={(e) => setForm((p) => ({ ...p, state: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Referencia"
              value={form.reference}
              onChange={(e) => setForm((p) => ({ ...p, reference: e.target.value }))}
              helperText="Entre qué calles, color de la casa, timbre"
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button variant="contained" onClick={() => void guardar()} disabled={saving}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}
