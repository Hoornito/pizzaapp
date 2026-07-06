'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';

interface Props {
  params: Promise<{ token: string }>;
}

export default function WhatsAppTokenPage({ params }: Props) {
  const { token } = use(params);
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'used'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch(`/api/whatsapp/validate-token?token=${token}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.valid) {
          setStatus('valid');
        } else {
          setStatus(d.expired ? 'used' : 'invalid');
          setMessage(d.error || 'El enlace no es válido');
        }
      })
      .catch(() => {
        setStatus('invalid');
        setMessage('Error al validar el enlace');
      });
  }, [token]);

  const handleStartOrder = () => {
    router.push(`/menu?wt=${token}`);
  };

  if (status === 'loading') {
    return (
      <Container maxWidth="sm">
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 8, gap: 2 }}>
          <CircularProgress />
          <Typography>Verificando enlace...</Typography>
        </Box>
      </Container>
    );
  }

  if (status === 'invalid' || status === 'used') {
    return (
      <Container maxWidth="sm">
        <Box sx={{ py: 8 }}>
          <Alert severity="error" sx={{ mb: 3 }}>
            {status === 'used'
              ? 'Este enlace ya fue utilizado o expiró'
              : message || 'El enlace no es válido'}
          </Alert>
          <Typography color="text.secondary" gutterBottom>
            Los enlaces de pedido tienen una validez de 2 horas. Para obtener uno nuevo, escribinos por WhatsApp.
          </Typography>
          <Button variant="contained" onClick={() => router.push('/menu')} sx={{ mt: 2 }}>
            Ver Menú
          </Button>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Box sx={{ py: 8 }}>
        <Paper sx={{ p: 4, textAlign: 'center' }}>
          <Typography variant="h2" sx={{ mb: 2 }}>🍕</Typography>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            ¡Bienvenido!
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 4 }}>
            Tu enlace de pedido fue verificado correctamente.
            Hacé click para empezar a elegir tus productos.
          </Typography>
          <Button
            variant="contained"
            size="large"
            fullWidth
            onClick={handleStartOrder}
            sx={{ py: 1.5, fontSize: '1.1rem' }}
          >
            Hacer mi pedido
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
            Este enlace es válido por 2 horas
          </Typography>
        </Paper>
      </Box>
    </Container>
  );
}
