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
        // Ensure all 7 days are present
        const filled = Array.from({ length: 7 }, (_, i) => {
          const existing = data.find((h: any) => h.dayOfWeek === i);
          return existing || { dayOfWeek: i, isOpen: false, openTime: '18:00', closeTime: '23:00' };
        });
        setHours(filled);
      })
      .finally(() => setLoading(false));
  }, []);

  const update = (dayOfWeek: number, field: string, value: any) => {
    setHours((prev) => prev.map((h) => h.dayOfWeek === dayOfWeek ? { ...h, [field]: value } : h));
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
          <Typography variant="h4" fontWeight={700}>Horarios de atención</Typography>
          <Typography color="text.secondary">Configurá los días y horarios en que recibís pedidos</Typography>
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
              <TableCell align="center"><strong>Abierto</strong></TableCell>
              <TableCell><strong>Apertura</strong></TableCell>
              <TableCell><strong>Cierre</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {hours.map((h) => (
              <TableRow key={h.dayOfWeek}>
                <TableCell>
                  <Typography fontWeight={500}>{DAYS[h.dayOfWeek]}</Typography>
                </TableCell>
                <TableCell align="center">
                  <Switch
                    checked={h.isOpen}
                    onChange={(e) => update(h.dayOfWeek, 'isOpen', e.target.checked)}
                    color="primary"
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    type="time"
                    size="small"
                    value={h.openTime}
                    onChange={(e) => update(h.dayOfWeek, 'openTime', e.target.value)}
                    disabled={!h.isOpen}
                    sx={{ width: 130 }}
                  />
                </TableCell>
                <TableCell>
                  <TextField
                    type="time"
                    size="small"
                    value={h.closeTime}
                    onChange={(e) => update(h.dayOfWeek, 'closeTime', e.target.value)}
                    disabled={!h.isOpen}
                    sx={{ width: 130 }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}
