'use client';

import { useState, useEffect } from 'react';
import { signIn, getProviders } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import type { LoginInput } from '@/lib/validators';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') || '/menu';
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialProviders, setSocialProviders] = useState<{ google: boolean; facebook: boolean }>({
    google: false,
    facebook: false,
  });

  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>();

  // Mostramos solo los botones sociales que estén configurados en el servidor.
  useEffect(() => {
    getProviders()
      .then((p) => setSocialProviders({ google: !!p?.google, facebook: !!p?.facebook }))
      .catch(() => {});
  }, []);

  const hasSocial = socialProviders.google || socialProviders.facebook;

  const onSubmit = async (data: LoginInput) => {
    setLoading(true);
    setError('');
    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      });

      if (result?.error) {
        setError('Email o contraseña incorrectos');
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch {
      setError('Error al iniciar sesión');
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
        Iniciar Sesión
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
        Ingresá a tu cuenta para continuar
      </Typography>

      {(error || searchParams.get('error')) && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error || 'No se pudo iniciar sesión con ese proveedor. Probá de nuevo.'}
        </Alert>
      )}

      {hasSocial && (
        <>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 1 }}>
            {socialProviders.google && (
              <Button
                variant="outlined"
                fullWidth
                size="large"
                startIcon={<GoogleIcon />}
                onClick={() => signIn('google', { callbackUrl })}
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
                onClick={() => signIn('facebook', { callbackUrl })}
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
          label="Email"
          type="email"
          fullWidth
          autoComplete="email"
          {...register('email', { required: 'El email es requerido' })}
          error={!!errors.email}
          helperText={errors.email?.message}
        />
        <TextField
          label="Contraseña"
          type="password"
          fullWidth
          autoComplete="current-password"
          {...register('password', { required: 'La contraseña es requerida' })}
          error={!!errors.password}
          helperText={errors.password?.message}
        />

        <Button
          type="submit"
          variant="contained"
          fullWidth
          size="large"
          disabled={loading}
          sx={{ py: 1.5, mt: 1 }}
        >
          {loading ? 'Ingresando...' : 'Ingresar'}
        </Button>
      </Box>

      <Divider sx={{ my: 3 }} />

      <Typography variant="body2" textAlign="center">
        ¿No tenés cuenta?{' '}
        <Link href="/register" style={{ color: '#C62828', fontWeight: 600 }}>
          Registrate
        </Link>
      </Typography>
    </Box>
  );
}
