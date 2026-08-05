'use client';

import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Typography from '@mui/material/Typography';
import { ORDER_STATUS_LABELS, orderStatusSteps } from '@/lib/constants';

/**
 * Progreso del pedido como barras por etapa (en vez de los pasos numerados).
 *
 * - Etapa cumplida  → barra llena.
 * - Etapa en curso  → barra con animación infinita (todavía no sabemos cuánto falta).
 * - Etapa pendiente → barra vacía.
 *
 * El pedido arranca en RECIBIDO: ahí la primera etapa (Confirmado) ya está "en
 * curso". Cada vez que el local avanza el estado, esa barra se completa y la
 * siguiente empieza a animarse, hasta Entregado.
 */

/** Estados intermedios viejos que hoy no son una etapa propia pero ya implican confirmado. */
const IMPLIES_CONFIRMED = ['PREPARANDO', 'EN_HORNO'];

interface OrderProgressProps {
  status: string;
  deliveryType?: string;
}

export function OrderProgress({ status, deliveryType }: OrderProgressProps) {
  const steps = orderStatusSteps(deliveryType);

  // Cuántas etapas quedaron atrás. El índice +1 son las cumplidas; si el estado
  // no es una etapa (RECIBIDO, o un intermedio viejo), lo resolvemos aparte.
  const idx = steps.indexOf(status);
  const done = idx >= 0 ? idx + 1 : IMPLIES_CONFIRMED.includes(status) ? 1 : 0;

  return (
    <Box sx={{ display: 'flex', gap: { xs: 0.75, sm: 1.5 }, alignItems: 'flex-start' }}>
      {steps.map((step, i) => {
        const complete = i < done;
        const active = i === done;
        return (
          <Box key={step} sx={{ flex: 1, minWidth: 0 }}>
            <LinearProgress
              variant={active ? 'indeterminate' : 'determinate'}
              value={complete ? 100 : 0}
              color={complete || active ? 'primary' : 'inherit'}
              sx={{
                height: 8,
                borderRadius: 4,
                bgcolor: 'grey.300',
                // Sin color asignado MUI deja la barra transparente: la pendiente
                // tiene que verse como un riel gris.
                '& .MuiLinearProgress-bar': {
                  bgcolor: complete || active ? 'primary.main' : 'transparent',
                },
              }}
            />
            <Typography
              variant="caption"
              sx={{
                display: 'block', mt: 0.75, textAlign: 'center',
                fontWeight: active ? 700 : 400,
                color: complete || active ? 'text.primary' : 'text.disabled',
                fontSize: { xs: '0.65rem', sm: '0.75rem' },
                lineHeight: 1.2,
              }}
            >
              {ORDER_STATUS_LABELS[step] || step}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
