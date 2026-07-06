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
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useSnackbar } from '@/app/snackbar-context';
import { formatCurrency, formatDateShort } from '@/lib/utils';

type EmployeeRole = 'COCINERO' | 'REPARTIDOR' | 'OTRO';

const ROLE_LABELS: Record<EmployeeRole, string> = {
  COCINERO: 'Cocinero',
  REPARTIDOR: 'Repartidor',
  OTRO: 'Otro',
};

interface EmployeeForm {
  firstName: string;
  lastName: string;
  phone: string;
  relativePhone: string;
  address: string;
  role: EmployeeRole;
  dailyWage: string;
  hireDate: string;
  active: boolean;
}

const emptyForm: EmployeeForm = {
  firstName: '',
  lastName: '',
  phone: '',
  relativePhone: '',
  address: '',
  role: 'OTRO',
  dailyWage: '',
  hireDate: new Date().toISOString().split('T')[0],
  active: true,
};

export default function EmployeesPage() {
  const { showSuccess, showError } = useSnackbar();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [saving, setSaving] = useState(false);

  // Diálogo de movimiento de saldo (descuento adelanto / aporte / retiro a favor)
  const [movCtx, setMovCtx] = useState<{ emp: any; kind: string; title: string } | null>(null);
  const [movForm, setMovForm] = useState({ amount: '', note: '' });

  const loadEmployees = () => {
    fetch('/api/admin/employees')
      .then((r) => r.json())
      .then((d) => setEmployees(d.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadEmployees(); }, []);

  const openDialog = (emp?: any) => {
    setEditing(emp || null);
    setForm(
      emp
        ? {
            firstName: emp.firstName,
            lastName: emp.lastName,
            phone: emp.phone || '',
            relativePhone: emp.relativePhone || '',
            address: emp.address || '',
            role: (emp.role as EmployeeRole) || 'OTRO',
            dailyWage: String(emp.dailyWage),
            hireDate: new Date(emp.hireDate).toISOString().split('T')[0],
            active: emp.active,
          }
        : emptyForm
    );
    setDialogOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const url = editing ? `/api/admin/employees/${editing.id}` : '/api/admin/employees';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: form.firstName,
          lastName: form.lastName,
          phone: form.phone || null,
          relativePhone: form.relativePhone || null,
          address: form.address || null,
          role: form.role,
          dailyWage: Number(form.dailyWage || 0),
          hireDate: form.hireDate,
          active: form.active,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showError(json.error || 'Error al guardar');
        return;
      }
      showSuccess(editing ? 'Empleado actualizado' : 'Empleado creado');
      setDialogOpen(false);
      loadEmployees();
    } catch {
      showError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const openMov = (emp: any, kind: string, title: string) => {
    setMovForm({ amount: '', note: '' });
    setMovCtx({ emp, kind, title });
  };

  const handleSaveMov = async () => {
    if (!movCtx) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/employees/${movCtx.emp.id}/movements`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: movCtx.kind, amount: Number(movForm.amount), note: movForm.note || null }),
      });
      const json = await res.json();
      if (!res.ok) {
        showError(json.error || 'Error al registrar');
        return;
      }
      showSuccess('Movimiento registrado');
      setMovCtx(null);
      loadEmployees();
    } catch {
      showError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (emp: any) => {
    if (!confirm(`¿Eliminar a ${emp.firstName} ${emp.lastName}?`)) return;
    const res = await fetch(`/api/admin/employees/${emp.id}`, { method: 'DELETE' });
    const json = await res.json();
    if (res.ok) {
      showSuccess('Empleado eliminado');
      loadEmployees();
    } else {
      showError(json.error || 'Error al eliminar');
    }
  };

  if (loading) return <LoadingSpinner message="Cargando empleados..." />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4" fontWeight={700}>Empleados</Typography>
          <Typography color="text.secondary">Gestión del personal para sueldos y adelantos</Typography>
        </Box>
        <Button variant="contained" onClick={() => openDialog()}>+ Nuevo empleado</Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell><strong>Nombre</strong></TableCell>
              <TableCell><strong>Rol</strong></TableCell>
              <TableCell><strong>Teléfono</strong></TableCell>
              <TableCell><strong>Tel. familiar</strong></TableCell>
              <TableCell align="right"><strong>Sueldo/día</strong></TableCell>
              <TableCell align="center"><strong>Adelantos pend.</strong></TableCell>
              <TableCell align="center"><strong>Acumulado a favor</strong></TableCell>
              <TableCell align="center"><strong>Ingreso</strong></TableCell>
              <TableCell align="center"><strong>Estado</strong></TableCell>
              <TableCell><strong>Acciones</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {employees.length === 0 && (
              <TableRow>
                <TableCell colSpan={10} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No hay empleados cargados
                </TableCell>
              </TableRow>
            )}
            {employees.map((emp) => (
              <TableRow key={emp.id} hover>
                <TableCell>
                  <Typography fontWeight={500}>{emp.firstName} {emp.lastName}</Typography>
                  {emp.address && (
                    <Typography variant="caption" color="text.secondary">{emp.address}</Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip
                    label={ROLE_LABELS[(emp.role as EmployeeRole) || 'OTRO']}
                    size="small"
                    color={emp.role === 'REPARTIDOR' ? 'primary' : emp.role === 'COCINERO' ? 'secondary' : 'default'}
                    variant="outlined"
                  />
                </TableCell>
                <TableCell>{emp.phone || '—'}</TableCell>
                <TableCell>{emp.relativePhone || '—'}</TableCell>
                <TableCell align="right">{formatCurrency(emp.dailyWage)}</TableCell>
                <TableCell align="center">
                  <Typography fontWeight={600} color={emp.adelantosPendientes > 0 ? 'error.main' : 'text.primary'}>
                    {formatCurrency(emp.adelantosPendientes)}
                  </Typography>
                  <Button
                    size="small"
                    disabled={emp.adelantosPendientes <= 0}
                    onClick={() => openMov(emp, 'ADELANTO_DESCUENTO', `Descontar adelanto · ${emp.firstName} ${emp.lastName}`)}
                  >
                    Descontar
                  </Button>
                </TableCell>
                <TableCell align="center">
                  <Typography fontWeight={600} color={emp.acumulado > 0 ? 'success.main' : 'text.primary'}>
                    {formatCurrency(emp.acumulado)}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                    <Button
                      size="small"
                      onClick={() => openMov(emp, 'ACUMULADO_APORTE', `Sumar a favor · ${emp.firstName} ${emp.lastName}`)}
                    >
                      Cargar
                    </Button>
                    <Button
                      size="small"
                      color="warning"
                      disabled={emp.acumulado <= 0}
                      onClick={() => openMov(emp, 'ACUMULADO_RETIRO', `Retirar a favor · ${emp.firstName} ${emp.lastName}`)}
                    >
                      Retirar
                    </Button>
                  </Box>
                </TableCell>
                <TableCell align="center">{formatDateShort(emp.hireDate)}</TableCell>
                <TableCell align="center">
                  <Chip
                    label={emp.active ? 'Activo' : 'Inactivo'}
                    color={emp.active ? 'success' : 'default'}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" onClick={() => openDialog(emp)}>Editar</Button>
                    <Button size="small" color="error" onClick={() => handleDelete(emp)}>Eliminar</Button>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Editar empleado' : 'Nuevo empleado'}</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ pt: 1 }}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Nombre *"
                value={form.firstName}
                onChange={(e) => setForm((p) => ({ ...p, firstName: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Apellido *"
                value={form.lastName}
                onChange={(e) => setForm((p) => ({ ...p, lastName: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Teléfono"
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Teléfono de familiar"
                value={form.relativePhone}
                onChange={(e) => setForm((p) => ({ ...p, relativePhone: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Dirección"
                value={form.address}
                onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth>
                <InputLabel id="emp-role-label">Rol *</InputLabel>
                <Select
                  labelId="emp-role-label"
                  label="Rol *"
                  value={form.role}
                  onChange={(e) => setForm((p) => ({ ...p, role: e.target.value as EmployeeRole }))}
                >
                  <MenuItem value="COCINERO">Cocinero</MenuItem>
                  <MenuItem value="REPARTIDOR">Repartidor</MenuItem>
                  <MenuItem value="OTRO">Otro</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Sueldo por día *"
                type="number"
                inputProps={{ min: 0, step: 0.01 }}
                value={form.dailyWage}
                onChange={(e) => setForm((p) => ({ ...p, dailyWage: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Fecha de ingreso *"
                type="date"
                value={form.hireDate}
                onChange={(e) => setForm((p) => ({ ...p, hireDate: e.target.value }))}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Switch
                  checked={form.active}
                  onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
                />
                <Typography>Empleado activo</Typography>
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving || !form.firstName || !form.lastName || form.dailyWage === '' || !form.hireDate}
          >
            Guardar
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de movimiento de saldo */}
      <Dialog open={movCtx !== null} onClose={() => setMovCtx(null)} maxWidth="xs" fullWidth>
        <DialogTitle>{movCtx?.title}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Monto *"
              type="number"
              inputProps={{ min: 0, step: 0.01 }}
              value={movForm.amount}
              onChange={(e) => setMovForm((p) => ({ ...p, amount: e.target.value }))}
              fullWidth
              autoFocus
            />
            <TextField
              label="Nota"
              value={movForm.note}
              onChange={(e) => setMovForm((p) => ({ ...p, note: e.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMovCtx(null)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSaveMov}
            disabled={saving || !movForm.amount || Number(movForm.amount) <= 0}
          >
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
