'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useSnackbar } from '@/app/snackbar-context';

interface Props {
  params: Promise<{ id: string }>;
}

export default function AdminUserDetailPage({ params }: Props) {
  const { id } = use(params);
  const router = useRouter();
  const { showSuccess, showError } = useSnackbar();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/users/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setUser(d.data);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) {
        showError(json.error || 'No se pudo borrar el usuario');
        return;
      }
      showSuccess('Usuario borrado');
      router.push('/admin/users');
    } catch {
      showError('Error de conexión');
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  if (loading) return <LoadingSpinner message="Cargando usuario..." />;
  if (!user) return <Box><Typography>Usuario no encontrado</Typography></Box>;

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Button onClick={() => router.push('/admin/users')}>← Volver</Button>
        <Typography variant="h4" fontWeight={700}>{user.name || 'Usuario'}</Typography>
        <Chip label={user.role} color={user.role === 'ADMIN' ? 'error' : 'default'} />
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: 3 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>Datos del usuario</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">Email</Typography>
                <Typography>{user.email}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Teléfono</Typography>
                <Typography>{user.phone || 'No registrado'}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Registrado</Typography>
                <Typography>{formatDate(user.createdAt)}</Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="text.secondary">Total de pedidos</Typography>
                <Typography>{user._count?.orders || 0}</Typography>
              </Box>
            </Box>
          </Paper>

          {/* Solo clientes sin pedidos: el resto lo rechaza el servidor igual
              (ver deleteCustomerUser), acá sólo evitamos ofrecer lo imposible. */}
          {user.role === 'CUSTOMER' && (
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" fontWeight={600} gutterBottom>Borrar usuario</Typography>
              {user._count?.orders > 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No se puede borrar: tiene pedidos, que son parte del historial de ventas.
                </Typography>
              ) : (
                <Button variant="outlined" color="error" fullWidth onClick={() => setConfirmOpen(true)}>
                  Borrar usuario
                </Button>
              )}
            </Paper>
          )}
        </Box>

        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" fontWeight={600} gutterBottom>Pedidos del usuario</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell><strong>Pedido</strong></TableCell>
                <TableCell><strong>Fecha</strong></TableCell>
                <TableCell><strong>Estado</strong></TableCell>
                <TableCell align="right"><strong>Total</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(user.orders || []).map((order: any) => (
                <TableRow
                  key={order.id}
                  hover
                  sx={{ cursor: 'pointer' }}
                  onClick={() => router.push(`/admin/orders/${order.id}`)}
                >
                  <TableCell>#{order.orderNumber}</TableCell>
                  <TableCell>{formatDate(order.createdAt)}</TableCell>
                  <TableCell>
                    <Chip
                      label={ORDER_STATUS_LABELS[order.status as keyof typeof ORDER_STATUS_LABELS]}
                      color={ORDER_STATUS_COLORS[order.status as keyof typeof ORDER_STATUS_COLORS] as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell align="right">{formatCurrency(order.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {(!user.orders || user.orders.length === 0) && (
            <Typography color="text.secondary" sx={{ mt: 2 }}>
              Sin pedidos
            </Typography>
          )}
        </Paper>
      </Box>

      <ConfirmDialog
        open={confirmOpen}
        title="¿Borrar este usuario?"
        description={`Se borra la cuenta de ${user.email || user.name || 'este usuario'} con sus direcciones. No se puede deshacer.`}
        confirmLabel="Borrar"
        destructive
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmOpen(false)}
      />
    </Box>
  );
}
