'use client';

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import TextField from '@mui/material/TextField';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useSnackbar } from '@/app/snackbar-context';
import { formatCurrency, formatDateShort } from '@/lib/utils';
import { computeSeniority, formatYearsMonths } from '@/lib/seniority';

const ROLE_LABELS: Record<string, string> = { COCINERO: 'Cocinero', REPARTIDOR: 'Repartidor', OTRO: 'Otro' };

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const emptyForm = () => ({ years: '1', paidAt: today(), amount: '', note: '' });

/**
 * Ficha del empleado (se abre al tocar el nombre en la tabla): datos, saldos y
 * antigüedad, con el historial de años pre-cobrados.
 */
export function EmployeeDetailDialog({
  employee,
  onClose,
  onChanged,
  onEdit,
}: {
  employee: any | null;
  onClose: () => void;
  /** Se llama al agregar/borrar un pre-cobro, para refrescar la tabla. */
  onChanged: () => void;
  onEdit: (emp: any) => void;
}) {
  const { showSuccess, showError } = useSnackbar();
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const employeeId = employee?.id;
  const load = (id: string) => {
    setLoading(true);
    fetch(`/api/admin/employees/${id}/seniority`, { cache: 'no-store' })
      .then((r) => r.json())
      .then((json) => setPayouts(json.data || []))
      .catch(() => setPayouts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (!employeeId) return;
    setPayouts([]);
    setForm(emptyForm());
    load(employeeId);
  }, [employeeId]);

  if (!employee) return null;

  // Los años pre-cobrados salen del historial (si ya cargó) para que el
  // resumen se actualice apenas se agrega o borra un registro.
  const prepaidYears = loading
    ? employee.prepaidSeniorityYears ?? 0
    : payouts.reduce((s, p) => s + p.years, 0);
  const seniority = computeSeniority(employee.hireDate, prepaidYears);
  const disponibles = seniority.total.years - prepaidYears;

  const handleAdd = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/employees/${employee.id}/seniority`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          years: Number(form.years),
          paidAt: form.paidAt,
          amount: form.amount === '' ? null : Number(form.amount),
          note: form.note || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        showError(json?.error || 'Error al registrar');
        return;
      }
      showSuccess('Años pre-cobrados registrados');
      setForm(emptyForm());
      load(employee.id);
      onChanged();
    } catch {
      showError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (payout: any) => {
    if (!confirm(`¿Eliminar el registro de ${payout.years} año${payout.years === 1 ? '' : 's'} pre-cobrado${payout.years === 1 ? '' : 's'} del ${formatDateShort(payout.paidAt)}?`)) return;
    const res = await fetch(`/api/admin/employees/${employee.id}/seniority/${payout.id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      showError(json?.error || 'Error al eliminar');
      return;
    }
    showSuccess('Registro eliminado');
    load(employee.id);
    onChanged();
  };

  return (
    <Dialog open onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography variant="h6" fontWeight={700} component="span">
            {employee.firstName} {employee.lastName}
          </Typography>
          <Chip label={ROLE_LABELS[employee.role] || 'Otro'} size="small" variant="outlined" />
          <Chip
            label={employee.active ? 'Activo' : 'Inactivo'}
            color={employee.active ? 'success' : 'default'}
            size="small"
          />
        </Box>
      </DialogTitle>
      <DialogContent dividers>
        {/* Datos */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Field label="Teléfono" value={employee.phone || '—'} />
          <Field label="Teléfono de familiar" value={employee.relativePhone || '—'} />
          <Field label="Dirección" value={employee.address || '—'} />
          <Field label="Fecha de ingreso" value={formatDateShort(employee.hireDate)} />
          <Field label="Sueldo por día" value={formatCurrency(employee.dailyWage)} />
          <Field label="Adelantos pendientes" value={formatCurrency(employee.adelantosPendientes)} />
          <Field label="Acumulado a favor" value={formatCurrency(employee.acumulado)} />
        </Grid>

        <Divider sx={{ mb: 2 }} />

        <AccountSection employee={employee} onChanged={onChanged} />

        <Divider sx={{ my: 2 }} />

        {/* Antigüedad */}
        <Typography variant="subtitle1" fontWeight={700} gutterBottom>Antigüedad</Typography>
        <Grid container spacing={2} sx={{ mb: 1 }}>
          <Grid item xs={12} sm={4}>
            <SeniorityBox
              title="Antigüedad total"
              value={formatYearsMonths(seniority.total)}
              hint={`Desde el ${formatDateShort(employee.hireDate)}`}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <SeniorityBox
              title="Años pre-cobrados"
              value={prepaidYears === 1 ? '1 año' : `${prepaidYears} años`}
              hint="Pagados por adelantado"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <SeniorityBox
              title="Antigüedad vigente"
              value={formatYearsMonths(seniority.current)}
              hint="Lo que se paga si se va"
              highlight
            />
          </Grid>
        </Grid>

        {/* Historial de pre-cobros */}
        <Typography variant="subtitle2" fontWeight={700} sx={{ mt: 3, mb: 1 }}>
          Historial de años pre-cobrados
        </Typography>
        {loading ? (
          <Typography variant="body2" color="text.secondary">Cargando…</Typography>
        ) : payouts.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No pre-cobró años de antigüedad.</Typography>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Fecha</TableCell>
                <TableCell align="center">Años</TableCell>
                <TableCell align="right">Monto</TableCell>
                <TableCell>Nota</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {payouts.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{formatDateShort(p.paidAt)}</TableCell>
                  <TableCell align="center">{p.years}</TableCell>
                  <TableCell align="right">{p.amount != null ? formatCurrency(p.amount) : '—'}</TableCell>
                  <TableCell>{p.note || '—'}</TableCell>
                  <TableCell align="right">
                    <Tooltip title="Eliminar registro">
                      <IconButton size="small" color="error" onClick={() => handleDelete(p)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Registrar pre-cobro */}
        <Paper variant="outlined" sx={{ p: 2, mt: 3 }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>Registrar años pre-cobrados</Typography>
          {disponibles <= 0 ? (
            <Typography variant="body2" color="text.secondary">
              No tiene años cumplidos disponibles para pre-cobrar.
            </Typography>
          ) : (
            <>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Puede pre-cobrar hasta {disponibles} año{disponibles === 1 ? '' : 's'}. Esto no registra un
                egreso en la caja.
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} sm={2}>
                  <TextField
                    label="Años *"
                    type="number"
                    inputProps={{ min: 1, max: disponibles, step: 1 }}
                    value={form.years}
                    onChange={(e) => setForm((p) => ({ ...p, years: e.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={6} sm={3}>
                  <TextField
                    label="Fecha del cobro *"
                    type="date"
                    InputLabelProps={{ shrink: true }}
                    value={form.paidAt}
                    onChange={(e) => setForm((p) => ({ ...p, paidAt: e.target.value }))}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} sm={3}>
                  <TextField
                    label="Monto pagado"
                    type="number"
                    inputProps={{ min: 0, step: 0.01 }}
                    value={form.amount}
                    onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
                    fullWidth
                    helperText="Opcional"
                  />
                </Grid>
                <Grid item xs={12} sm={4}>
                  <TextField
                    label="Nota"
                    value={form.note}
                    onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
                    fullWidth
                  />
                </Grid>
              </Grid>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                <Button
                  variant="contained"
                  onClick={handleAdd}
                  disabled={
                    saving ||
                    !form.paidAt ||
                    !Number.isInteger(Number(form.years)) ||
                    Number(form.years) < 1 ||
                    Number(form.years) > disponibles
                  }
                >
                  Registrar
                </Button>
              </Box>
            </>
          )}
        </Paper>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onEdit(employee)}>Editar datos</Button>
        <Button variant="contained" onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <Grid item xs={12} sm={6} md={4}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography fontWeight={500}>{value}</Typography>
    </Grid>
  );
}

function SeniorityBox({ title, value, hint, highlight }: { title: string; value: string; hint: string; highlight?: boolean }) {
  return (
    <Paper
      variant="outlined"
      sx={{ p: 2, height: '100%', ...(highlight && { borderColor: 'primary.main', bgcolor: 'action.hover' }) }}
    >
      <Typography variant="caption" color="text.secondary">{title}</Typography>
      <Typography variant="h6" fontWeight={700} color={highlight ? 'primary.main' : 'text.primary'}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">{hint}</Typography>
    </Paper>
  );
}

/**
 * Cuenta con la que el empleado entra a ver su legajo en el perfil: crearla
 * (email + contraseña), vincular una que ya tenga (p. ej. la de Google) o
 * desvincularla.
 */
function AccountSection({ employee, onChanged }: { employee: any; onChanged: () => void }) {
  const { showSuccess, showError } = useSnackbar();
  const [mode, setMode] = useState<'create' | 'link' | 'password' | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const user = employee.user as { id: string; email: string | null; role: string } | null;

  const reset = () => { setMode(null); setEmail(''); setPassword(''); };

  const submit = async () => {
    if (!mode) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/employees/${employee.id}/account`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          mode === 'create' ? { action: mode, email, password }
            : mode === 'link' ? { action: mode, email }
              : { action: mode, password }
        ),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        showError(json?.error || 'Error');
        return;
      }
      showSuccess(mode === 'create' ? 'Cuenta creada' : mode === 'link' ? 'Cuenta vinculada' : 'Contraseña actualizada');
      reset();
      onChanged();
    } catch {
      showError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  const unlink = async () => {
    if (!confirm(`¿Desvincular la cuenta ${user?.email}? La cuenta sigue existiendo, pero deja de ver el legajo.`)) return;
    const res = await fetch(`/api/admin/employees/${employee.id}/account`, { method: 'DELETE' });
    if (!res.ok) {
      showError('Error al desvincular');
      return;
    }
    showSuccess('Cuenta desvinculada');
    reset();
    onChanged();
  };

  const canSubmit =
    mode === 'create' ? !!email && password.length >= 6
      : mode === 'link' ? !!email
        : password.length >= 6;

  return (
    <Box sx={{ mb: 1 }}>
      <Typography variant="subtitle1" fontWeight={700} gutterBottom>Cuenta de acceso</Typography>
      {user ? (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2">
            Entra con <strong>{user.email}</strong> y ve su legajo en <em>Mi perfil</em>.
          </Typography>
          <Box sx={{ flex: 1 }} />
          {user.role === 'CUSTOMER' && (
            <Button size="small" onClick={() => setMode(mode === 'password' ? null : 'password')}>
              Nueva contraseña
            </Button>
          )}
          <Button size="small" color="error" onClick={unlink}>Desvincular</Button>
        </Box>
      ) : (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="body2" color="text.secondary">
            No tiene cuenta. Con una cuenta puede ver su antigüedad, saldos e historial.
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button size="small" variant={mode === 'create' ? 'contained' : 'outlined'} onClick={() => setMode('create')}>
            Crear cuenta
          </Button>
          <Button size="small" variant={mode === 'link' ? 'contained' : 'outlined'} onClick={() => setMode('link')}>
            Vincular cuenta existente
          </Button>
        </Box>
      )}

      {mode && (
        <Paper variant="outlined" sx={{ p: 2, mt: 1.5 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {mode === 'create' &&
              'Se crea una cuenta con este email y contraseña. Si el email es de Google, también va a poder entrar con "Continuar con Google".'}
            {mode === 'link' &&
              'Para empleados que ya tienen cuenta (con email y contraseña, o con Google). Ingresá el email con el que entran.'}
            {mode === 'password' && 'Nueva contraseña para la cuenta del empleado. Pasásela para que después la cambie desde su perfil.'}
          </Typography>
          <Grid container spacing={2}>
            {mode !== 'password' && (
              <Grid item xs={12} sm={mode === 'create' ? 6 : 12}>
                <TextField
                  label="Email *"
                  type="email"
                  autoComplete="off"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  fullWidth
                />
              </Grid>
            )}
            {mode !== 'link' && (
              <Grid item xs={12} sm={mode === 'create' ? 6 : 12}>
                <TextField
                  label="Contraseña *"
                  type="text"
                  autoComplete="off"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  helperText="Mínimo 6 caracteres"
                  fullWidth
                />
              </Grid>
            )}
          </Grid>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
            <Button onClick={reset} disabled={saving}>Cancelar</Button>
            <Button variant="contained" onClick={submit} disabled={saving || !canSubmit}>
              {mode === 'create' ? 'Crear cuenta' : mode === 'link' ? 'Vincular' : 'Guardar contraseña'}
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
}
