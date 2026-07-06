'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import { useState } from 'react';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { EmptyState } from '@/components/ui/EmptyState';
import type { OrderWithRelations } from '@/types/order.types';
import type { OrderStatus } from '@prisma/client';
import { formatCurrency, formatTimeAgo } from '@/lib/utils';
import Link from 'next/link';

interface ActiveOrdersPanelProps {
  orders: OrderWithRelations[];
  onStatusChange?: (orderId: string, status: OrderStatus) => void;
}

const NEXT_STATUS: Record<string, OrderStatus> = {
  RECIBIDO: 'CONFIRMADO',
  CONFIRMADO: 'PREPARANDO',
  PREPARANDO: 'EN_HORNO',
  EN_HORNO: 'LISTO',
  LISTO: 'EN_REPARTO',
  EN_REPARTO: 'ENTREGADO',
};

export function ActiveOrdersPanel({ orders, onStatusChange }: ActiveOrdersPanelProps) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardHeader
        title={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="h6" fontWeight={600}>Pedidos Activos</Typography>
            <Typography variant="body2" color="text.secondary">({orders.length})</Typography>
          </Box>
        }
        action={
          <Button component={Link} href="/admin/orders" size="small">
            Ver todos
          </Button>
        }
      />
      <CardContent sx={{ pt: 0, maxHeight: 400, overflow: 'auto' }}>
        {orders.length === 0 ? (
          <EmptyState icon="🎉" title="No hay pedidos activos" />
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {orders.map((order) => (
              <Box
                key={order.id}
                sx={{
                  p: 1.5,
                  border: '1px solid #e0e0e0',
                  borderRadius: 2,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 2,
                  flexWrap: 'wrap',
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={700}>
                    #{order.orderNumber}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {order.user.name} · {formatTimeAgo(order.createdAt)}
                  </Typography>
                </Box>

                <Box sx={{ flexGrow: 1 }} />

                <StatusBadge status={order.status} />

                <Typography variant="body2" fontWeight={600}>
                  {formatCurrency(Number(order.total))}
                </Typography>

                {NEXT_STATUS[order.status] && onStatusChange && (
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => onStatusChange(order.id, NEXT_STATUS[order.status])}
                  >
                    Avanzar
                  </Button>
                )}

                <Button
                  component={Link}
                  href={`/admin/orders/${order.id}`}
                  size="small"
                  variant="text"
                >
                  Ver
                </Button>
              </Box>
            ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
