'use client';

import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import { enablePush, getPushConfig, getPushState, type PushState } from '@/lib/push-client';
import { useSession } from 'next-auth/react';
import { useSnackbar } from '@/app/snackbar-context';
import { isStaff } from '@/lib/roles';
import { iosNeedsInstall } from '@/lib/pwa';

const DISMISSED_KEY = 'push:dismissed';
// "Ahora no" calla el cartel una semana, no para siempre: el que lo descarta
// esperando una pizza igual quiere que le avisen en el pedido siguiente.
const DISMISS_DIAS = 7;

function descartadoHaceMenosDeUnaSemana(): boolean {
  const raw = localStorage.getItem(DISMISSED_KEY);
  if (!raw) return false;
  const cuando = Number(raw);
  // Valor viejo del formato anterior ('1'): lo tratamos como vencido.
  if (!Number.isFinite(cuando) || cuando <= 0) return false;
  return Date.now() - cuando < DISMISS_DIAS * 24 * 60 * 60 * 1000;
}

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
  const { data: session } = useSession();
  const { showSuccess, showError } = useSnackbar();

  useEffect(() => {
    void (async () => {
      const [current, config] = await Promise.all([getPushState(), getPushConfig()]);
      setState(current);
      setAvailable(config.web || config.native);
      setDismissed(descartadoHaceMenosDeUnaSemana());
    })();
  }, []);

  // Mostrador y admin no reciben avisos de pedido (ver PushSetup).
  if (isStaff(session?.user?.role)) return null;

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
    if (ok) {
      showSuccess('Listo, te avisamos cuando cambie el estado de tu pedido');
      // Un aviso de confirmación al toque: es la única forma de que el cliente
      // vea que el canal quedó abierto y no se entere recién (o nunca) cuando
      // el local mueva el pedido.
      void fetch('/api/push/test', { method: 'POST' }).catch(() => {});
    } else {
      showError('No pudimos activar las notificaciones');
    }
  };

  const descartar = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
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
