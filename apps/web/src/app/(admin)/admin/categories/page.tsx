'use client';

import { useState, useEffect } from 'react';
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
import TextField from '@mui/material/TextField';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import Switch from '@mui/material/Switch';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useSnackbar } from '@/app/snackbar-context';

export default function AdminCategoriesPage() {
  const { showSuccess, showError } = useSnackbar();
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [form, setForm] = useState({ name: '', slug: '', description: '', icon: '', sortOrder: 0 });

  const loadCategories = () => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => setCategories(d.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadCategories(); }, []);

  const openDialog = (category?: any) => {
    setEditingCategory(category || null);
    setForm(category ? { name: category.name, slug: category.slug || '', description: category.description || '', icon: category.icon || '', sortOrder: category.sortOrder } : { name: '', slug: '', description: '', icon: '', sortOrder: 0 });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const url = editingCategory ? `/api/categories/${editingCategory.id}` : '/api/categories';
    const method = editingCategory ? 'PUT' : 'POST';
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        showError(json.error || 'Error al guardar');
        return;
      }
      showSuccess(editingCategory ? 'Categoría actualizada' : 'Categoría creada');
      setDialogOpen(false);
      loadCategories();
    } catch {
      showError('Error de conexión');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta categoría?')) return;
    const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setCategories((prev) => prev.filter((c) => c.id !== id));
      showSuccess('Categoría eliminada');
    } else {
      showError('No se puede eliminar: tiene productos asociados');
    }
  };

  if (loading) return <LoadingSpinner message="Cargando categorías..." />;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Categorías</Typography>
        <Button variant="contained" onClick={() => openDialog()}>+ Nueva categoría</Button>
      </Box>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.100' }}>
              <TableCell><strong>Nombre</strong></TableCell>
              <TableCell><strong>Descripción</strong></TableCell>
              <TableCell align="center"><strong>Orden</strong></TableCell>
              <TableCell align="center"><strong>Productos</strong></TableCell>
              <TableCell><strong>Acciones</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {categories.map((cat) => (
              <TableRow key={cat.id} hover>
                <TableCell>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {cat.icon && <Typography sx={{ fontSize: '1.5rem' }}>{cat.icon}</Typography>}
                    <Typography fontWeight={500}>{cat.name}</Typography>
                  </Box>
                </TableCell>
                <TableCell>{cat.description}</TableCell>
                <TableCell align="center">{cat.sortOrder}</TableCell>
                <TableCell align="center">{cat._count?.products || 0}</TableCell>
                <TableCell>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" onClick={() => openDialog(cat)}>Editar</Button>
                    <Button size="small" color="error" onClick={() => handleDelete(cat.id)}>Eliminar</Button>
                  </Box>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editingCategory ? 'Editar categoría' : 'Nueva categoría'}</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
            <TextField
              label="Nombre *"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Slug *"
              value={form.slug}
              onChange={(e) => setForm((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
              fullWidth
              helperText="Ej: pizzas, empanadas, bebidas"
            />
            <TextField
              label="Descripción"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Ícono (emoji o texto)"
              value={form.icon}
              onChange={(e) => setForm((p) => ({ ...p, icon: e.target.value }))}
              fullWidth
              placeholder="🍕"
            />
            <TextField
              label="Orden de visualización"
              type="number"
              value={form.sortOrder}
              onChange={(e) => setForm((p) => ({ ...p, sortOrder: Number(e.target.value) }))}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.name || !form.slug}>
            Guardar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
