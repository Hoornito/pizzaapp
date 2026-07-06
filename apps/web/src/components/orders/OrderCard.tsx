'use client';

import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import Link from 'next/link';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { OrderWithRelations } from '@/types/order.types';
import { formatDate, formatCurrency } from '@/lib/utils';

interface OrderCardProps {
  order: OrderWithRelations;
}

export function OrderCard({ order }: OrderCardProps) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Box>
            <Typography variant="subtitle1" fontWeight={700}>
              Pedido #{order.orderNumber}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {formatDate(order.createdAt)}
            </Typography>
          </Box>
          <StatusBadge status={order.status} />
        </Box>

        <Divider sx={{ mb: 2 }} />

        <Box sx={{ mb: 2 }}>
          {order.items.slice(0, 3).map((item) => (
            <Typography key={item.id} variant="body2" color="text.secondary">
              {item.quantity}x {item.product?.name || item.promotion?.name}
            </Typography>
          ))}
          {order.items.length > 3 && (
            <Typography variant="body2" color="text.secondary">
              +{order.items.length - 3} más...
            </Typography>
          )}
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box>
            <Typography variant="caption" color="text.secondary">
              {order.deliveryType === 'DELIVERY' ? '🛵 Delivery' : '🏪 Retiro'}
            </Typography>
            <Typography variant="h6" fontWeight={700} color="primary.main">
              {formatCurrency(Number(order.total))}
            </Typography>
          </Box>
          <Button
            component={Link}
            href={`/orders/${order.id}`}
            variant="outlined"
            size="small"
            endIcon={<OpenInNewIcon />}
          >
            Ver detalle
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
