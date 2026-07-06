'use client';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Stepper from '@mui/material/Stepper';
import Step from '@mui/material/Step';
import StepLabel from '@mui/material/StepLabel';
import type { OrderStatus } from '@prisma/client';
import { ORDER_STATUS_LABELS } from '@/types/order.types';

const STATUS_FLOW: OrderStatus[] = [
  'RECIBIDO',
  'CONFIRMADO',
  'LISTO',
  'EN_REPARTO',
  'ENTREGADO',
];

const STATUS_ICONS: Record<string, string> = {
  RECIBIDO: '📥',
  CONFIRMADO: '✅',
  PREPARANDO: '👨‍🍳',
  EN_HORNO: '🔥',
  LISTO: '🎉',
  EN_REPARTO: '🛵',
  ENTREGADO: '🏠',
  CANCELADO: '❌',
};

interface OrderTimelineProps {
  status: OrderStatus;
}

export function OrderTimeline({ status }: OrderTimelineProps) {
  if (status === 'CANCELADO') {
    return (
      <Box sx={{ textAlign: 'center', p: 3 }}>
        <Typography variant="h3">❌</Typography>
        <Typography variant="h6" color="error">
          Pedido Cancelado
        </Typography>
      </Box>
    );
  }

  const currentIndex = STATUS_FLOW.indexOf(status);

  return (
    <Stepper activeStep={currentIndex} orientation="vertical" sx={{ px: 0 }}>
      {STATUS_FLOW.map((s, index) => (
        <Step key={s} completed={index <= currentIndex}>
          <StepLabel
            StepIconComponent={() => (
              <Box
                sx={{
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  bgcolor: index <= currentIndex ? 'primary.main' : 'grey.300',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1rem',
                }}
              >
                {STATUS_ICONS[s]}
              </Box>
            )}
          >
            <Typography
              variant="body2"
              fontWeight={s === status ? 700 : 400}
              color={s === status ? 'primary.main' : index > currentIndex ? 'text.disabled' : 'text.primary'}
            >
              {ORDER_STATUS_LABELS[s]}
            </Typography>
          </StepLabel>
        </Step>
      ))}
    </Stepper>
  );
}
