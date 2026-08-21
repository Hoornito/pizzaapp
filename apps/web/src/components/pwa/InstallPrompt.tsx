'use client';

import { useCallback, useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import InstallMobileIcon from '@mui/icons-material/InstallMobile';
import IosShareIcon from '@mui/icons-material/IosShare';
import AddBoxOutlinedIcon from '@mui/icons-material/AddBoxOutlined';
import { isIos, isStandalone } from '@/lib/pwa';

const DISMISSED_KEY = 'pwa:install-dismissed';

/** El evento de Chrome para instalar; no está en los tipos del DOM. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/**
 * Invita a instalar la app en la pantalla de inicio.
 *
 * Android/Chrome da un diálogo nativo (`beforeinstallprompt`). iOS no tiene API
 * para eso: hay que explicarle al cliente que use Compartir → Agregar a inicio,
 * y encima ahí es obligatorio, porque Safari no manda notificaciones push a un
 * sitio que no esté instalado.
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosDialog, setIosDialog] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISSED_KEY) === '1') return;

    // En iOS no hay evento: si el sitio no está instalado, mostramos el cartel
    // igual y al tocarlo explicamos los pasos.
    if (isIos()) {
      setVisible(true);
      return;
    }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    const onInstalled = () => setVisible(false);

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const descartar = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  }, []);

  const instalar = useCallback(async () => {
    if (isIos()) {
      setIosDialog(true);
      return;
    }
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === 'accepted') setVisible(false);
    else descartar();
  }, [deferred, descartar]);

  if (!visible) return null;

  return (
    <>
      <Alert
        icon={<InstallMobileIcon fontSize="inherit" />}
        severity="info"
        sx={{ mb: 2, alignItems: 'center' }}
        action={
          <>
            <Button size="small" onClick={descartar}>
              Ahora no
            </Button>
            <Button size="small" variant="contained" onClick={() => void instalar()}>
              Instalar
            </Button>
          </>
        }
      >
        Instalá Cambalache en tu celular: entrás con un toque y te avisamos cuando tu pedido
        esté listo.
      </Alert>

      <Dialog open={iosDialog} onClose={() => setIosDialog(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Instalar en tu iPhone</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Son dos toques desde Safari. Hace falta hacerlo para poder recibir los avisos del
            pedido.
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <IosShareIcon color="primary" />
            <Typography variant="body2">
              1. Tocá <strong>Compartir</strong>, abajo en la barra de Safari.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <AddBoxOutlinedIcon color="primary" />
            <Typography variant="body2">
              2. Elegí <strong>Agregar a inicio</strong> y confirmá.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setIosDialog(false)}>Listo</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
