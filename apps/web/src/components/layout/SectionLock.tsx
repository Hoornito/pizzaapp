'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import LockIcon from '@mui/icons-material/Lock';
import type { Role } from '@prisma/client';
import { isAdmin, isLockedSectionPath } from '@/lib/roles';
import { PinCodeField } from '@/components/ui/PinCodeField';

/**
 * Tapa las secciones sensibles (dashboard, reportes, finanzas, empleados) hasta
 * que el admin ingresa el código. El desbloqueo vive solo en memoria: se pierde
 * al salir a una sección no bloqueada o al recargar la página.
 */
export function SectionLock({ role, children }: { role: Role; children: React.ReactNode }) {
  const pathname = usePathname();
  const locked = isAdmin(role) && isLockedSectionPath(pathname);
  const [unlocked, setUnlocked] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Al salir de las secciones bloqueadas se vuelve a pedir el código.
  useEffect(() => {
    if (!locked) {
      setUnlocked(false);
      setCode('');
      setError('');
    }
  }, [locked]);

  if (!locked || unlocked) return <>{children}</>;

  const submit = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/admin/sections-unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json().catch(() => null);
      if (data?.ok) {
        setUnlocked(true);
        setCode('');
      } else {
        setError(res.status === 429 ? 'Demasiados intentos. Esperá un minuto.' : 'Código incorrecto');
        setCode('');
      }
    } catch {
      setError('Error al verificar el código');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', pt: { xs: 4, md: 10 } }}>
      <Paper sx={{ p: 4, width: '100%', maxWidth: 360, textAlign: 'center' }}>
        <LockIcon color="action" sx={{ fontSize: 48, mb: 1 }} />
        <Typography variant="h6" fontWeight={700} gutterBottom>
          Sección protegida
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Ingresá el código de 4 dígitos para ver esta pantalla.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }}>{error}</Alert>}
        <PinCodeField
          label="Código"
          autoFocus
          value={code}
          onChange={setCode}
          onComplete={submit}
          disabled={loading}
        />
        <Button
          variant="contained"
          fullWidth
          sx={{ mt: 2 }}
          onClick={submit}
          disabled={loading || code.length !== 4}
        >
          {loading ? 'Verificando…' : 'Ingresar'}
        </Button>
      </Paper>
    </Box>
  );
}
