'use client';

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useSnackbar } from '@/app/snackbar-context';

export default function DiscountsPage() {
  const { showSuccess, showError } = useSnackbar();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [percentage, setPercentage] = useState('');
  const [label, setLabel] = useState('');
  const [active, setActive] = useState(false);

  useEffect(() => {
    fetch('/api/settings/discount?all=1', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!d.data) return;
        setPercentage(d.data.percentage ? String(d.data.percentage) : '');
        setLabel(d.data.label || '');
        setActive(!!d.data.active);
      })
      .finally(() => setLoading(false));
  }, []);

  const pct = parseFloat(percentage);
  const pctOk = Number.isFinite(pct) && pct > 0 && pct <= 100;

  const save = async (next?: { active: boolean }) => {
    const activo = next ? next.active : active;
    if (activo && (!pctOk || !label.trim())) {
      showError('Para activarlo cargá el porcentaje y el motivo.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/settings/discount', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ percentage: pctOk ? pct : 0, label: label.trim(), active: activo }),
      });
      const json = await res.json();
      if (!res.ok) { showError(json.error || 'No se pudo guardar'); return; }
      setActive(json.data.active);
      showSuccess(json.data.active ? 'Descuento activo ✓' : 'Descuento guardado (desactivado)');
    } catch {
      showError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Cargando descuento..." />;

  return (
    <Paper sx={{ p: 3, maxWidth: 620 }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>Descuento de la app</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Se le aplica al subtotal de <strong>los pedidos que hacen los clientes desde la web</strong>.
        Los que cargás vos en mostrador (o por WhatsApp) siguen a precio de lista.
      </Typography>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
        <TextField
          label="Descuento"
          type="number"
          value={percentage}
          onChange={(e) => setPercentage(e.target.value)}
          inputProps={{ min: 0, max: 100, step: 1 }}
          sx={{ width: 150 }}
          InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
          error={percentage !== '' && !pctOk}
        />
        <TextField
          label="Motivo"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Promo lanzamiento"
          sx={{ flex: 1, minWidth: 240 }}
          helperText="Es el texto que ve el cliente en el cartel"
          inputProps={{ maxLength: 60 }}
        />
      </Box>

      {/* Lo que va a ver el cliente, con los valores de arriba. */}
      {pctOk && label.trim() && (
        <Alert severity="info" icon={false} sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary">Así lo ve el cliente:</Typography>
          <Typography fontWeight={900} sx={{ textTransform: 'uppercase' }}>
            {label.trim()} · {pct}% de descuento!
          </Typography>
        </Alert>
      )}

      <FormControlLabel
        control={
          <Switch
            checked={active}
            disabled={saving}
            onChange={(e) => { setActive(e.target.checked); save({ active: e.target.checked }); }}
          />
        }
        label={active ? 'Activo — los clientes lo ven y se les aplica' : 'Desactivado'}
      />

      <Box sx={{ mt: 2 }}>
        <Button variant="contained" onClick={() => save()} disabled={saving}>
          {saving ? 'Guardando…' : 'Guardar cambios'}
        </Button>
      </Box>
    </Paper>
  );
}
