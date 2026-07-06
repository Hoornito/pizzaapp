'use client';

import { useState, useEffect } from 'react';
import { signIn, getProviders } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Divider from '@mui/material/Divider';
import GoogleIcon from '@mui/icons-material/Google';
import FacebookIcon from '@mui/icons-material/Facebook';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { BrandLogo } from '@/components/layout/BrandLogo';
import type { RegisterInput } from '@/lib/validators';

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialProviders, setSocialProviders] = useState<{ google: boolean; facebook: boolean }>({
    google: false,
    facebook: false,
  });

  const { register, handleSubmit, formState: { errors } } = useForm<RegisterInput>();

  useEffect(() => {
    getProviders()
      .then((p) => setSocialProviders({ google: !!p?.google, facebook: !!p?.facebook }))
      .catch(() => {});
  }, []);

  const hasSocial = socialProviders.google || socialProviders.facebook;

  const onSubmit = async (data: RegisterInput) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      const json = await res.json();
      if (!res.ok) {
        setError(json.error || 'Error al registrarse');
        return;
      }

      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        router.push('/login');
      } else {
        router.push('/menu');
      }
    } catch {
      setError('Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 380 }}>
      <Box sx={{ display: { xs: 'flex', md: 'none' }, flexDirection: 'column', alignItems: 'center', mb: 4 }}>
        <BrandLogo size={150} showText={false} />
        <Typography variant="h5" fontWeight={800} color="primary.main" sx={{ mt: 1 }}>Pizzería Cambalache</Typography>
      </Box>

      <Typography variant="h4" fontWeight={700} gutterBottom>
        Crear Cuenta
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Registrate para realizar pedidos
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {hasSocial && (
        <>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 1 }}>
            {socialProviders.google && (
              <Button
                variant="outlined"
                fullWidth
                size="large"
                startIcon={<GoogleIcon />}
                onClick={() => signIn('google', { callbackUrl: '/menu' })}
                sx={{ py: 1.25, textTransform: 'none', borderColor: 'divider', color: 'text.primary' }}
              >
                Continuar con Google
              </Button>
            )}
            {socialProviders.facebook && (
              <Button
                variant="outlined"
                fullWidth
                size="large"
                startIcon={<FacebookIcon />}
                onClick={() => signIn('facebook', { callbackUrl: '/menu' })}
                sx={{ py: 1.25, textTransform: 'none', borderColor: 'divider', color: '#1877F2' }}
              >
                Continuar con Facebook
              </Button>
            )}
          </Box>
          <Divider sx={{ my: 2 }}>o con tu email</Divider>
        </>
      )}

      <Box component="form" onSubmit={handleSubmit(onSubmit)} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          label="Nombre completo"
          fullWidth
          {...register('name', { required: 'El nombre es requerido', minLength: { value: 2, message: 'Mínimo 2 caracteres' } })}
          error={!!errors.name}
          helperText={errors.name?.message}
        />
        <TextField
          label="Email"
          type="email"
          fullWidth
          {...register('email', { required: 'El email es requerido' })}
          error={!!errors.email}
          helperText={errors.email?.message}
        />
        <TextField
          label="Teléfono"
          fullWidth
          {...register('phone', {
            required: 'El teléfono es requerido',
            minLength: { value: 6, message: 'Ingresá un teléfono válido' },
          })}
          error={!!errors.phone}
          helperText={errors.phone?.message || 'Lo usamos para coordinar tu pedido'}
        />
        <TextField
          label="Contraseña"
          type="password"
          fullWidth
          {...register('password', { required: 'La contraseña es requerida', minLength: { value: 6, message: 'Mínimo 6 caracteres' } })}
          error={!!errors.password}
          helperText={errors.password?.message}
        />

        <Button type="submit" variant="contained" fullWidth size="large" disabled={loading} sx={{ py: 1.5, mt: 1 }}>
          {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
        </Button>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="body2" textAlign="center">
        ¿Ya tenés cuenta?{' '}
        <Link href="/login" style={{ color: '#C62828', fontWeight: 600 }}>
          Iniciar sesión
        </Link>
      </Typography>
    </Box>
  );
}
