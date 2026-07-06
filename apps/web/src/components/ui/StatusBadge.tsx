'use client';

import Chip from '@mui/material/Chip';
import type { OrderStatus } from '@prisma/client';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/types/order.types';

interface StatusBadgeProps {
  status: OrderStatus;
  size?: 'small' | 'medium';
}

export function StatusBadge({ status, size = 'small' }: StatusBadgeProps) {
  const label = ORDER_STATUS_LABELS[status] || status;
  const color = ORDER_STATUS_COLORS[status] || '#9E9E9E';

  return (
    <Chip
      label={label}
      size={size}
      sx={{
        backgroundColor: color,
        color: '#fff',
        fontWeight: 600,
        fontSize: size === 'small' ? '0.7rem' : '0.8rem',
      }}
    />
  );
}
