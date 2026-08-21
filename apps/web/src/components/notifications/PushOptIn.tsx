'use client';

import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { enablePush, getPushConfig, getPushState, type PushState } from '@/lib/push-client';
import { useSnackbar } from '@/app/snackbar-context';
import { iosNeedsInstall } from '@/lib/pwa';

const DISMISSED_KEY = 'push:dismissed';

/**
 * Cartel para activar los avisos del estado del pedido. Se muestra sólo si el
 * dispositivo los soporta, el server tiene las credenciales cargadas y el
 * cliente todavía no decidió nada.
 */
export function PushOptIn() {
  const [state, setState] = useState<PushState | null>(null);
  const [available, setAvailable] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [working, setWorking] = useState(false);
  const { showSuccess, showError } = useSnackbar();

  useEffect(() => {
    void (async () => {
      const [current, config] = await Promise.all([getPushState(), getPushConfig()]);
      setState(current);
      setAvailable(config.web || config.native);
      setDismissed(localStorage.getItem(DISMISSED_KEY) === '1');
    })();
  }, []);

  // En iPhone sin instalar no hay nada que activar: Safari no manda push a un
  // sitio que no esté en la pantalla de inicio. De eso se encarga InstallPrompt,
  // y este cartel aparece recién cuando la app ya está instalada.
  if (iosNeedsInstall()) return null;

  if (!available || state !== 'default' || dismissed) return null;

  const activar = async () => {
    setWorking(true);
    const ok = await enablePush({ askPermission: true });
    setWorking(false);
    setState(await getPushState());
    if (ok) showSuccess('Listo, te avisamos cuando cambie el estado de tu pedido');
    else showError('No pudimos activar las notificaciones');
  };

  const descartar = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  };

  return (
    <Alert
      icon={<NotificationsActiveIcon fontSize="inherit" />}
      severity="info"
      sx={{ mb: 2, alignItems: 'center' }}
      action={
        <>
          <Button size="small" onClick={descartar} disabled={working}>
            Ahora no
          </Button>
          <Button size="small" variant="contained" onClick={activar} disabled={working}>
            Activar
          </Button>
        </>
      }
    >
      Activá los avisos y te notificamos cuando tu pedido esté confirmado, listo y en camino.
    </Alert>
  );
}
