'use client';

import { useState, useEffect } from 'react';
import Grid from '@mui/material/Grid';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils';
import { StatCard } from '@/components/admin/StatCard';
import { RevenueChart } from '@/components/admin/RevenueChart';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

interface DashboardStats {
  todayRevenue: number;
  weekRevenue: number;
  monthRevenue: number;
  activeOrders: number;
  pendingOrders: number;
  deliveredToday: number;
  revenueByDay: { date: string; revenue: number }[];
  recentOrders: any[];
}

export default function DashboardPage() {
  const router = useRouter();
  const { socket } = useSocket();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = () => {
    fetch('/api/admin/dashboard/stats')
      .then((r) => r.json())
      .then((d) => setStats(d.data))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStats();
  }, []);

  useEffect(() => {
    if (!socket) return;
    socket.emit('join:admin');
    socket.on('order:created', loadStats);
    socket.on('order:status_changed', loadStats);
    return () => {
      socket.off('order:created', loadStats);
      socket.off('order:status_changed', loadStats);
    };
  }, [socket]);

  if (loading) return <LoadingSpinner message="Cargando dashboard..." />;
  if (!stats) return null;

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>Dashboard</Typography>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Ingresos hoy"
            value={formatCurrency(stats.todayRevenue)}
            icon="💰"
            color="#C62828"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Ingresos esta semana"
            value={formatCurrency(stats.weekRevenue)}
            icon="📈"
            color="#1565C0"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Pedidos activos"
            value={stats.activeOrders}
            icon="🔥"
            color="#E65100"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Entregados hoy"
            value={stats.deliveredToday}
            icon="✅"
            color="#2E7D32"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>Ingresos (últimos 7 días)</Typography>
            <RevenueChart data={stats.revenueByDay} />
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" fontWeight={600}>Pedidos recientes</Typography>
              <Button size="small" onClick={() => router.push('/admin/orders')}>Ver todos</Button>
            </Box>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {stats.recentOrders.slice(0, 5).map((order: any) => (
                <Box
                  key={order.id}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    '&:hover': { opacity: 0.7 },
                  }}
                  onClick={() => router.push(`/admin/orders/${order.id}`)}
                >
                  <Box>
                    <Typography variant="body2" fontWeight={600}>#{order.orderNumber}</Typography>
                    <Typography variant="caption" color="text.secondary">{order.user?.name}</Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Chip
                      label={ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS]}
                      color={ORDER_STATUS_COLORS[order.status as keyof typeof ORDER_STATUS_COLORS] as any}
                      size="small"
                    />
                    <Typography variant="caption" color="text.secondary" display="block">
                      {formatCurrency(order.total)}
                    </Typography>
                  </Box>
                </Box>
              ))}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
