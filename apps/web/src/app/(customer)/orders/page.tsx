'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { EmptyState } from '@/components/ui/EmptyState';
import type { Order } from '@prisma/client';

export default function OrdersPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login?callbackUrl=/orders');
      return;
    }
    if (status === 'authenticated') {
      fetch('/api/orders/my')
        .then((r) => r.json())
        .then((d) => setOrders(d.data || []))
        .finally(() => setLoading(false));
    }
  }, [status, router]);

  if (status === 'loading' || loading) return <LoadingSpinner message="Cargando pedidos..." />;

  return (
    <Container maxWidth="md">
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Mis Pedidos
      </Typography>

      {orders.length === 0 ? (
        <EmptyState
          icon="📦"
          title="No tenés pedidos aún"
          description="Cuando realices tu primer pedido, aparecerá aquí"
          action={{ label: 'Ver menú', href: '/menu' }}
        />
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {orders.map((order: any) => (
            <Paper key={order.id} sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                <Box>
                  <Typography variant="h6" fontWeight={600}>
                    Pedido #{order.orderNumber}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {formatDate(order.createdAt)}
                  </Typography>
                </Box>
                <Chip
                  label={ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS] || order.status}
                  color={ORDER_STATUS_COLORS[order.status as keyof typeof ORDER_STATUS_COLORS] as any || 'default'}
                  size="small"
                />
              </Box>

              <Divider sx={{ my: 1.5 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="body2" color="text.secondary">
                  {order._count?.items || 0} productos · {order.deliveryType === 'DELIVERY' ? '🛵 Delivery' : '🏪 Retiro'}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                  <Typography variant="h6" fontWeight={700} color="primary">
                    {formatCurrency(order.total)}
                  </Typography>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => router.push(`/orders/${order.id}`)}
                  >
                    Ver detalle
                  </Button>
                </Box>
              </Box>
            </Paper>
          ))}
        </Box>
      )}
    </Container>
  );
}
