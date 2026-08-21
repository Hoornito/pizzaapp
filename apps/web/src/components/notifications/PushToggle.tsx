'use client';

import { useEffect, useState } from 'react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Switch from '@mui/material/Switch';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { disablePush, enablePush, getPushConfig, getPushState, type PushState } from '@/lib/push-client';
import { useSnackbar } from '@/app/snackbar-context';
import { iosNeedsInstall } from '@/lib/pwa';

/**
 * Prender/apagar los avisos del estado del pedido desde el perfil. Es el lugar
 * al que vuelve el cliente que le dio "Ahora no" al cartel de Mis pedidos.
 */
export function PushToggle() {
  const [state, setState] = useState<PushState | null>(null);
  const [available, setAvailable] = useState(false);
  const [working, setWorking] = useState(false);
  const { showSuccess, showError } = useSnackbar();

  useEffect(() => {
    void (async () => {
      const [current, config] = await Promise.all([getPushState(), getPushConfig()]);
      setState(current);
      setAvailable(config.web || config.native);
    })();
  }, []);

  // iPhone sin instalar: el interruptor no serviría de nada, así que explicamos
  // el paso que falta en vez de mostrar un control muerto.
  if (iosNeedsInstall()) {
    return (
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" fontWeight={600}>
          Avisos del pedido
        </Typography>
        <Alert severity="info" sx={{ mt: 2 }}>
          Para recibir los avisos en iPhone hay que agregar Cambalache a la pantalla de inicio:
          en Safari, tocá <strong>Compartir</strong> y después <strong>Agregar a inicio</strong>.
          Abrila desde ahí y vas a poder activarlos.
        </Alert>
      </Paper>
    );
  }

  if (!available || state === null || state === 'unsupported') return null;

  const cambiar = async (prender: boolean) => {
    setWorking(true);
    if (prender) {
      const ok = await enablePush({ askPermission: true });
      if (ok) showSuccess('Avisos activados');
      else showError('No pudimos activar los avisos');
    } else {
      await disablePush();
      showSuccess('Avisos desactivados');
    }
    setState(await getPushState());
    setWorking(false);
  };

  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="h6" fontWeight={600}>
            Avisos del pedido
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Te notificamos cuando tu pedido se confirma, está listo y sale en camino.
          </Typography>
        </Box>
        <Switch
          checked={state === 'granted'}
          disabled={working || state === 'denied'}
          onChange={(e) => void cambiar(e.target.checked)}
        />
      </Box>

      {state === 'denied' && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          Bloqueaste las notificaciones para este sitio. Para volver a activarlas hay que
          permitirlas desde la configuración del navegador o del celular.
        </Alert>
      )}

      {state === 'granted' && (
        <Button
          size="small"
          sx={{ mt: 1 }}
          disabled={working}
          onClick={async () => {
            const res = await fetch('/api/push/test', { method: 'POST' });
            const json = await res.json().catch(() => null);
            if (json?.data?.enviados > 0) showSuccess('Te mandamos una notificación de prueba');
            else showError('No llegó a ningún dispositivo');
          }}
        >
          Mandar una de prueba
        </Button>
      )}
    </Paper>
  );
}
