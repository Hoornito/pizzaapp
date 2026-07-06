'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Divider from '@mui/material/Divider';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '@/lib/constants';
import { formatCurrency, formatDate } from '@/lib/utils';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
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
  const [newRole, setNewRole] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/users/${id}`)
      .then((r) => r.json())
      .then((d) => {
        setUser(d.data);
        setNewRole(d.data?.role || '');
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleUpdateRole = async () => {
    if (newRole === user.role) return;
    setUpdating(true);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      const json = await res.json();
      if (!res.ok) {
        showError(json.error || 'Error al actualizar rol');
        return;
      }
      setUser((prev: any) => ({ ...prev, role: newRole }));
      showSuccess('Rol actualizado');
    } catch {
      showError('Error de conexión');
    } finally {
      setUpdating(false);
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

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>Cambiar rol</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Rol</InputLabel>
                <Select value={newRole} label="Rol" onChange={(e) => setNewRole(e.target.value)}>
                  <MenuItem value="CUSTOMER">CUSTOMER</MenuItem>
                  <MenuItem value="ADMIN">ADMIN</MenuItem>
                </Select>
              </FormControl>
              <Button
                variant="contained"
                fullWidth
                onClick={handleUpdateRole}
                disabled={updating || newRole === user.role}
              >
                Actualizar rol
              </Button>
            </Box>
          </Paper>
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
    </Box>
  );
}
