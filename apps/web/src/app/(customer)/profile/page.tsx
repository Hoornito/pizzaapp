'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Avatar from '@mui/material/Avatar';
import { useSnackbar } from '@/app/snackbar-context';

export default function ProfilePage() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const { showSuccess, showError } = useSnackbar();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: session?.user.name || '',
    phone: session?.user.phone || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  if (!session) {
    router.push('/login?callbackUrl=/profile');
    return null;
  }

  const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/users/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, phone: form.phone }),
      });
      const json = await res.json();
      if (!res.ok) {
        showError(json.error || 'Error al actualizar perfil');
        return;
      }
      await update({ name: form.name, phone: form.phone });
      showSuccess('Perfil actualizado');
    } catch {
      showError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (form.newPassword !== form.confirmPassword) {
      showError('Las contraseñas no coinciden');
      return;
    }
    if (form.newPassword.length < 6) {
      showError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/users/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        showError(json.error || 'Error al cambiar contraseña');
        return;
      }
      showSuccess('Contraseña actualizada');
      setForm((prev) => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
    } catch {
      showError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  const initials = session.user.name
    ?.split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || 'U';

  return (
    <Container maxWidth="sm">
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Mi Perfil
      </Typography>

      {/* Avatar section */}
      <Paper sx={{ p: 3, mb: 3, display: 'flex', alignItems: 'center', gap: 3 }}>
        <Avatar sx={{ width: 72, height: 72, bgcolor: 'primary.main', fontSize: '1.5rem' }}>
          {initials}
        </Avatar>
        <Box>
          <Typography variant="h6" fontWeight={600}>{session.user.name}</Typography>
          <Typography color="text.secondary">{session.user.email}</Typography>
          <Typography variant="caption" color="text.secondary">
            {session.user.role === 'ADMIN' ? '⭐ Administrador' : 'Cliente'}
          </Typography>
        </Box>
      </Paper>

      {/* Profile form */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>Datos personales</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Nombre"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
            fullWidth
          />
          <TextField
            label="Email"
            value={session.user.email || ''}
            disabled
            fullWidth
            helperText="El email no puede modificarse"
          />
          <TextField
            label="Teléfono (WhatsApp)"
            value={form.phone}
            onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
            fullWidth
            placeholder="+5491112345678"
          />
          <Button
            variant="contained"
            onClick={handleUpdateProfile}
            disabled={loading}
            sx={{ alignSelf: 'flex-end' }}
          >
            Guardar cambios
          </Button>
        </Box>
      </Paper>

      {/* Password change */}
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>Cambiar contraseña</Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField
            label="Contraseña actual"
            type="password"
            value={form.currentPassword}
            onChange={(e) => setForm((p) => ({ ...p, currentPassword: e.target.value }))}
            fullWidth
          />
          <Divider />
          <TextField
            label="Nueva contraseña"
            type="password"
            value={form.newPassword}
            onChange={(e) => setForm((p) => ({ ...p, newPassword: e.target.value }))}
            fullWidth
          />
          <TextField
            label="Confirmar nueva contraseña"
            type="password"
            value={form.confirmPassword}
            onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))}
            fullWidth
          />
          <Button
            variant="outlined"
            onClick={handleChangePassword}
            disabled={loading || !form.currentPassword || !form.newPassword}
            sx={{ alignSelf: 'flex-end' }}
          >
            Cambiar contraseña
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}
