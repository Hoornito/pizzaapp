'use client';

import { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Switch from '@mui/material/Switch';
import Button from '@mui/material/Button';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useSnackbar } from '@/app/snackbar-context';

const DAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
/** Cada día tiene dos turnos: se pueden habilitar por separado. */
const SHIFTS = [
  { shift: 0, label: 'Mediodía', open: '11:00', close: '15:00' },
  { shift: 1, label: 'Noche', open: '18:00', close: '00:00' },
];

export default function BusinessHoursPage() {
  const { showSuccess, showError } = useSnackbar();
  const [hours, setHours] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings/hours')
      .then((r) => r.json())
      .then((d) => {
        const data = d.data || [];
        // Siempre 7 días × 2 turnos: los que no existan arrancan cerrados con un
        // horario sugerido, así la grilla nunca queda incompleta.
        const filled = Array.from({ length: 7 }, (_, day) =>
          SHIFTS.map((s) => {
            const existing = data.find((h: any) => h.dayOfWeek === day && (h.shift ?? 0) === s.shift);
            return existing || { dayOfWeek: day, shift: s.shift, isOpen: false, openTime: s.open, closeTime: s.close };
          })
        ).flat();
        setHours(filled);
      })
      .finally(() => setLoading(false));
  }, []);

  const update = (dayOfWeek: number, shift: number, field: string, value: any) => {
    setHours((prev) =>
      prev.map((h) => (h.dayOfWeek === dayOfWeek && h.shift === shift ? { ...h, [field]: value } : h))
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/hours', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hours),
      });
      if (res.ok) {
        showSuccess('Horarios guardados');
      } else {
        showError('Error al guardar');
      }
    } catch {
      showError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Cargando horarios..." />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h5" fontWeight={700}>Horarios de atención</Typography>
          <Typography color="text.secondary">
            Cada día tiene dos turnos. Con esto el cliente puede programar un pedido para el mediodía o para la noche.
          </Typography>
        </Box>
        <Button variant="contained" onClick={handleSave} disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </Button>
      </Box>

      <Paper>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell><strong>Día</strong></TableCell>
              <TableCell><strong>Turno</strong></TableCell>
              <TableCell align="center"><strong>Abierto</strong></TableCell>
              <TableCell><strong>Apertura</strong></TableCell>
              <TableCell><strong>Cierre</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {hours.map((h, i) => {
              const firstOfDay = i % SHIFTS.length === 0;
              return (
                <TableRow
                  key={`${h.dayOfWeek}-${h.shift}`}
                  sx={{ '& td': { borderBottom: firstOfDay ? 'none' : undefined } }}
                >
                  <TableCell>
                    {firstOfDay && <Typography fontWeight={500}>{DAYS[h.dayOfWeek]}</Typography>}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {SHIFTS.find((s) => s.shift === h.shift)?.label}
                    </Typography>
                  </TableCell>
                  <TableCell align="center">
                    <Switch
                      checked={h.isOpen}
                      onChange={(e) => update(h.dayOfWeek, h.shift, 'isOpen', e.target.checked)}
                      color="primary"
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="time"
                      size="small"
                      value={h.openTime}
                      onChange={(e) => update(h.dayOfWeek, h.shift, 'openTime', e.target.value)}
                      disabled={!h.isOpen}
                      sx={{ width: 130 }}
                    />
                  </TableCell>
                  <TableCell>
                    <TextField
                      type="time"
                      size="small"
                      value={h.closeTime}
                      onChange={(e) => update(h.dayOfWeek, h.shift, 'closeTime', e.target.value)}
                      disabled={!h.isOpen}
                      sx={{ width: 130 }}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
