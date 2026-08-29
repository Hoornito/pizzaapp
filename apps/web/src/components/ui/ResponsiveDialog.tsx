'use client';

import Dialog, { type DialogProps } from '@mui/material/Dialog';
import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

/**
 * Diálogo que en el celular ocupa toda la pantalla y en tablet/escritorio se
 * comporta exactamente como un `Dialog` normal (mismo `maxWidth` de siempre).
 *
 * Por qué: en pantallas chicas el diálogo centrado queda más alto que lo que se
 * ve —la barra del navegador se come el final— y el botón de "Agregar" del pie
 * queda fuera de alcance. A pantalla completa el pie siempre se ve, el contenido
 * scrollea en el medio y el botón queda fijo abajo.
 *
 * Usa `100dvh` (alto REAL visible) y no `100vh`, que en el celular mide de más
 * porque cuenta el espacio de la barra de direcciones aunque esté a la vista.
 */
export function ResponsiveDialog({ children, PaperProps, ...props }: DialogProps) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Dialog
      fullScreen={fullScreen}
      {...props}
      PaperProps={{
        ...PaperProps,
        sx: {
          ...(fullScreen && {
            height: '100dvh',
            maxHeight: '100dvh',
            // El pie no se mete abajo del notch / la barra de gestos.
            '& .MuiDialogActions-root': {
              paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
            },
          }),
          ...PaperProps?.sx,
        },
      }}
    >
      {children}
    </Dialog>
  );
}
