'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import { formatCurrency } from '@/lib/utils';
import { controlsStock } from '@/lib/constants';
import { PIZZA_SIZES, PIZZA_SIZE_LABELS } from '@/types/product.types';
import { invalidateMenuFlags, type MenuFlags } from '@/hooks/useMenuFlags';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useSnackbar } from '@/app/snackbar-context';

export default function AdminProductsPage() {
  const router = useRouter();
  const { showSuccess, showError } = useSnackbar();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('');

  // Disponibilidad del menú: la pizza no se lleva por stock en unidades, así que
  // se corta a mano cuando se acaba la masa de molde o los discos de un tamaño.
  // Apaga la opción en el menú del cliente, en las promos y en el mostrador.
  const [flags, setFlags] = useState<MenuFlags>({
    moldeDisabled: false,
    sizeDisabled: { SMALL: false, MEDIUM: false, LARGE: false },
  });
  const [savingFlags, setSavingFlags] = useState(false);

  // Diálogo de movimiento de stock (cargar / descontar)
  const [stockCtx, setStockCtx] = useState<{ product: any; kind: 'ENTRADA' | 'SALIDA' } | null>(null);
  const [stockForm, setStockForm] = useState({ quantity: '', note: '' });
  const [savingStock, setSavingStock] = useState(false);

  const loadProducts = () => {
    const params = categoryFilter ? `?categoryId=${categoryFilter}` : '';
    fetch(`/api/products${params}`)
      .then((r) => r.json())
      .then((d) => setProducts(d.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => setCategories(d.data || []));
    fetch('/api/settings/menu-flags', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => { if (d.data) setFlags(d.data); })
      .catch(() => {});
    loadProducts();
  }, []);

  const saveFlags = async (patch: Partial<MenuFlags>, aviso: string) => {
    setSavingFlags(true);
    try {
      const res = await fetch('/api/settings/menu-flags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      const json = await res.json();
      if (!res.ok) { showError(json.error || 'No se pudo guardar'); return; }
      setFlags(json.data);
      // El menú del cliente cachea los flags: los soltamos para que relea.
      invalidateMenuFlags();
      showSuccess(aviso);
    } catch {
      showError('Error de conexión');
    } finally {
      setSavingFlags(false);
    }
  };

  useEffect(() => { loadProducts(); }, [categoryFilter]);

  const toggleActive = async (product: any) => {
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ available: !product.available }),
      });
      if (res.ok) {
        setProducts((prev) => prev.map((p) => p.id === product.id ? { ...p, available: !p.available } : p));
        showSuccess(`Producto ${!product.available ? 'activado' : 'desactivado'}`);
      }
    } catch {
      showError('Error al actualizar producto');
    }
  };

  // Carga masiva de stock de la categoría elegida (postres, bebidas…): un
  // renglón por producto, como la pantalla de Postres.
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkQty, setBulkQty] = useState<Record<string, string>>({});
  const [savingBulk, setSavingBulk] = useState(false);

  const selectedCategory = categories.find((c) => c.id === categoryFilter);
  const categoryTracksStock = controlsStock(selectedCategory?.slug);

  const handleBulkStock = async () => {
    const entries = Object.entries(bulkQty)
      .map(([productId, q]) => ({ productId, quantity: Math.floor(Number(q)) }))
      .filter((e) => Number.isFinite(e.quantity) && e.quantity > 0);
    if (entries.length === 0) { showError('Ingresá al menos una cantidad'); return; }
    setSavingBulk(true);
    try {
      const res = await fetch('/api/products/stock/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId: categoryFilter, entries }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { showError(json.error || 'Error al cargar stock'); return; }
      showSuccess(`Stock cargado en ${json.applied} producto${json.applied === 1 ? '' : 's'}`);
      setBulkOpen(false);
      loadProducts();
    } catch {
      showError('Error de conexión');
    } finally {
      setSavingBulk(false);
    }
  };

  const openStock = (product: any, kind: 'ENTRADA' | 'SALIDA') => {
    setStockForm({ quantity: '', note: '' });
    setStockCtx({ product, kind });
  };

  const handleSaveStock = async () => {
    if (!stockCtx) return;
    setSavingStock(true);
    try {
      const res = await fetch(`/api/products/${stockCtx.product.id}/stock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind: stockCtx.kind,
          quantity: Number(stockForm.quantity),
          note: stockForm.note || null,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        showError(json.error || 'Error al ajustar el stock');
        return;
      }
      const newStock = json.data?.stock;
      setProducts((prev) => prev.map((p) => (p.id === stockCtx.product.id ? { ...p, stock: newStock } : p)));
      showSuccess(stockCtx.kind === 'ENTRADA' ? 'Stock cargado' : 'Stock descontado');
      setStockCtx(null);
    } catch {
      showError('Error de conexión');
    } finally {
      setSavingStock(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar este producto?')) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (res.ok) {
        setProducts((prev) => prev.filter((p) => p.id !== id));
        showSuccess('Producto eliminado');
      } else {
        showError(json.error || 'No se pudo eliminar el producto');
      }
    } catch {
      showError('Error al eliminar');
    }
  };

  if (loading) return <LoadingSpinner message="Cargando productos..." />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Productos</Typography>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Categoría</InputLabel>
            <Select value={categoryFilter} label="Categoría" onChange={(e) => setCategoryFilter(e.target.value)}>
              <MenuItem value="">Todas</MenuItem>
              {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </Select>
          </FormControl>
          {categoryFilter && products.length > 0 && (
            <Button
              variant="outlined"
              onClick={() => { setBulkQty({}); setBulkOpen(true); }}
            >
              📦 Cargar stock de {selectedCategory?.name}
            </Button>
          )}
          <Button variant="contained" onClick={() => router.push('/admin/products/new')}>
            + Nuevo producto
          </Button>
        </Box>
      </Box>

      {/* Corte rápido de lo que hoy no se puede hacer (sin masa, sin discos). */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" fontWeight={700} gutterBottom>
          Disponibilidad de pizzas
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          Apagá lo que se te haya acabado: en el menú del cliente, en las promos y en el
          mostrador aparece en gris y no se puede elegir.
        </Typography>
        <Box sx={{ display: 'flex', gap: { xs: 0, sm: 3 }, flexWrap: 'wrap', flexDirection: { xs: 'column', sm: 'row' } }}>
          <FormControlLabel
            control={
              <Switch
                checked={!flags.moldeDisabled}
                disabled={savingFlags}
                onChange={(e) =>
                  saveFlags(
                    { moldeDisabled: !e.target.checked },
                    e.target.checked ? 'Al molde habilitado' : 'Al molde deshabilitado'
                  )
                }
              />
            }
            label={flags.moldeDisabled ? '🍕 Al molde: sin stock' : '🍕 Al molde'}
          />
          {PIZZA_SIZES.map((size) => (
            <FormControlLabel
              key={size}
              control={
                <Switch
                  checked={!flags.sizeDisabled[size]}
                  disabled={savingFlags}
                  onChange={(e) =>
                    saveFlags(
                      { sizeDisabled: { ...flags.sizeDisabled, [size]: !e.target.checked } },
                      `${PIZZA_SIZE_LABELS[size]} ${e.target.checked ? 'habilitada' : 'deshabilitada'}`
                    )
                  }
                />
              }
              label={
                flags.sizeDisabled[size]
                  ? `${PIZZA_SIZE_LABELS[size]}: sin stock`
                  : PIZZA_SIZE_LABELS[size]
              }
            />
          ))}
        </Box>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell>Imagen</TableCell>
              <TableCell><strong>Nombre</strong></TableCell>
              <TableCell><strong>Categoría</strong></TableCell>
              <TableCell align="right"><strong>Precio</strong></TableCell>
              <TableCell align="center"><strong>Stock</strong></TableCell>
              <TableCell align="center"><strong>Activo</strong></TableCell>
              <TableCell><strong>Acciones</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id} hover>
                <TableCell>
                  {product.image ? (
                    <Box
                      component="img"
                      src={product.image}
                      alt={product.name}
                      sx={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 1 }}
                    />
                  ) : (
                    <Box sx={{ width: 48, height: 48, bgcolor: 'grey.200', borderRadius: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      🍕
                    </Box>
                  )}
                </TableCell>
                <TableCell>
                  <Typography fontWeight={500}>{product.name}</Typography>
                  {product.description && (
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ maxWidth: 200, display: 'block' }}>
                      {product.description}
                    </Typography>
                  )}
                </TableCell>
                <TableCell>
                  <Chip label={product.category?.name} size="small" variant="outlined" />
                </TableCell>
                <TableCell align="right">
                  <Typography fontWeight={600}>{formatCurrency(product.price)}</Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography fontWeight={700} color={product.stock <= 0 ? 'error.main' : 'text.primary'}>
                    {product.stock}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
                    <Button size="small" onClick={() => openStock(product, 'ENTRADA')}>Cargar</Button>
                    <Button size="small" color="warning" disabled={product.stock <= 0} onClick={() => openStock(product, 'SALIDA')}>
                      Descontar
                    </Button>
                  </Box>
                </TableCell>
                <TableCell align="center">
                  <Switch
                    checked={product.available}
                    onChange={() => toggleActive(product)}
                    color="primary"
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" onClick={() => router.push(`/admin/products/${product.id}`)}>
                      Editar
                    </Button>
                    <Button size="small" color="error" onClick={() => handleDelete(product.id)}>
                      Eliminar
                    </Button>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Carga de stock de toda una categoría, de una sola vez */}
      <Dialog open={bulkOpen} onClose={() => !savingBulk && setBulkOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          📦 Cargar stock · {selectedCategory?.name}
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
            Poné cuántas unidades entraron. Se suman al stock actual y queda registrado el movimiento.
          </Typography>
        </DialogTitle>
        <DialogContent dividers>
          {!categoryTracksStock && (
            <Alert severity="info" sx={{ mb: 2 }}>
              Esta categoría no descuenta stock al vender: podés llevar la cuenta igual, pero no
              bloquea la venta cuando llega a cero.
            </Alert>
          )}
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {products.map((p) => (
              <Box
                key={p.id}
                sx={{
                  display: 'flex', alignItems: 'center', gap: 1.5, p: 1,
                  border: '1px solid', borderColor: 'divider', borderRadius: 1,
                }}
              >
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={600}>{p.name}</Typography>
                  <Typography variant="caption" color={p.stock <= 0 ? 'error.main' : 'text.secondary'}>
                    Stock actual: <strong>{p.stock}</strong>
                  </Typography>
                </Box>
                <TextField
                  size="small"
                  type="number"
                  label="Entran"
                  value={bulkQty[p.id] ?? ''}
                  onChange={(e) => setBulkQty((prev) => ({ ...prev, [p.id]: e.target.value }))}
                  inputProps={{ min: 0, step: 1 }}
                  sx={{ width: 110 }}
                />
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkOpen(false)} disabled={savingBulk}>Cancelar</Button>
          <Button variant="contained" onClick={handleBulkStock} disabled={savingBulk}>
            {savingBulk ? 'Cargando…' : 'Cargar stock'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Diálogo de movimiento de stock */}
      <Dialog open={stockCtx !== null} onClose={() => setStockCtx(null)} maxWidth="xs" fullWidth>
        <DialogTitle>
          {stockCtx?.kind === 'ENTRADA' ? 'Cargar stock' : 'Descontar stock'}
          {stockCtx && ` · ${stockCtx.product.name}`}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Stock actual: <strong>{stockCtx?.product.stock}</strong>
            </Typography>
            <TextField
              label="Cantidad *"
              type="number"
              inputProps={{ min: 1, step: 1 }}
              value={stockForm.quantity}
              onChange={(e) => setStockForm((p) => ({ ...p, quantity: e.target.value }))}
              fullWidth
              autoFocus
            />
            <TextField
              label="Nota"
              value={stockForm.note}
              onChange={(e) => setStockForm((p) => ({ ...p, note: e.target.value }))}
              fullWidth
              multiline
              minRows={2}
              placeholder={stockCtx?.kind === 'ENTRADA' ? 'Ej: compra al proveedor' : 'Ej: merma / vencido'}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStockCtx(null)}>Cancelar</Button>
          <Button
            variant="contained"
            onClick={handleSaveStock}
            disabled={savingStock || !stockForm.quantity || Number(stockForm.quantity) <= 0}
          >
            Confirmar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
