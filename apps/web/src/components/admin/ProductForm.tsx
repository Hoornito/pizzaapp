'use client';

import { useState, useEffect } from 'react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

interface ProductFormProps {
  initialData?: any;
  onSubmit: (data: any) => Promise<void>;
}

export function ProductForm({ initialData, onSubmit }: ProductFormProps) {
  const [categories, setCategories] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    categoryId: '',
    image: '',
    available: true,
    sortOrder: 0,
    ...initialData,
    price: initialData?.price?.toString() || '',
    priceSmall: initialData?.priceSmall?.toString() || '',
    priceMedium: initialData?.priceMedium?.toString() || '',
    priceLarge: initialData?.priceLarge?.toString() || '',
  });

  useEffect(() => {
    fetch('/api/categories')
      .then((r) => r.json())
      .then((d) => setCategories(d.data || []));
  }, []);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const handleChange = (field: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const handleUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploadError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/uploads', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok) { setUploadError(json.error || 'No se pudo subir la imagen'); return; }
      handleChange('image', json.data.url);
    } catch {
      setUploadError('Error de conexión al subir la imagen');
    } finally {
      setUploading(false);
    }
  };

  const selectedCategory = categories.find((c) => c.id === form.categoryId);
  const isPizza = selectedCategory?.slug === 'pizzas';

  const toPriceOrNull = (v: string) => (v !== '' && !isNaN(parseFloat(v)) ? parseFloat(v) : null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        ...form,
        price: parseFloat(form.price),
        // Precios por tamaño solo para pizzas; en otros productos van null.
        priceSmall: isPizza ? toPriceOrNull(form.priceSmall) : null,
        priceMedium: isPizza ? toPriceOrNull(form.priceMedium) : null,
        priceLarge: isPizza ? toPriceOrNull(form.priceLarge) : null,
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper sx={{ p: 3, maxWidth: 700 }}>
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <TextField
            label="Nombre *"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
            fullWidth
          />
          <FormControl fullWidth required>
            <InputLabel>Categoría *</InputLabel>
            <Select
              value={form.categoryId}
              label="Categoría *"
              onChange={(e) => handleChange('categoryId', e.target.value)}
            >
              {categories.map((c) => <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>)}
            </Select>
          </FormControl>
        </Box>

        <TextField
          label="Descripción"
          value={form.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          multiline
          rows={2}
          fullWidth
        />

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <TextField
            label="Precio ($) *"
            type="number"
            inputProps={{ min: 0, step: '0.01' }}
            value={form.price}
            onChange={(e) => handleChange('price', e.target.value)}
            required
            fullWidth
          />
          <TextField
            label="Orden de visualización"
            type="number"
            value={form.sortOrder}
            onChange={(e) => handleChange('sortOrder', e.target.value)}
            fullWidth
          />
        </Box>

        {isPizza && (
          <Box>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>
              🍕 Precios por tamaño (dejá vacío el tamaño que no ofrecés)
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 2 }}>
              <TextField
                label="Chica ($)"
                type="number"
                inputProps={{ min: 0, step: '0.01' }}
                value={form.priceSmall}
                onChange={(e) => handleChange('priceSmall', e.target.value)}
                fullWidth
              />
              <TextField
                label="Mediana ($)"
                type="number"
                inputProps={{ min: 0, step: '0.01' }}
                value={form.priceMedium}
                onChange={(e) => handleChange('priceMedium', e.target.value)}
                fullWidth
              />
              <TextField
                label="Grande ($)"
                type="number"
                inputProps={{ min: 0, step: '0.01' }}
                value={form.priceLarge}
                onChange={(e) => handleChange('priceLarge', e.target.value)}
                fullWidth
              />
            </Box>
            <Typography variant="caption" color="text.secondary">
              El precio "base" de arriba se usa como referencia; en el menú la pizza se cobra por tamaño.
            </Typography>
          </Box>
        )}

        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <TextField
            label="URL de imagen"
            value={form.image || ''}
            onChange={(e) => handleChange('image', e.target.value)}
            sx={{ flex: 1, minWidth: 240 }}
            placeholder="https://... o /uploads/producto.jpg"
            helperText={uploadError || 'Podés pegar una URL o subir un archivo (máx 5MB)'}
            error={!!uploadError}
          />
          <Button component="label" variant="outlined" disabled={uploading} sx={{ mt: 1, whiteSpace: 'nowrap' }}>
            {uploading ? 'Subiendo…' : '📤 Subir imagen'}
            <input
              type="file"
              hidden
              accept="image/jpeg,image/png,image/webp,image/avif"
              onChange={(e) => handleUpload(e.target.files?.[0])}
            />
          </Button>
        </Box>

        {form.image && (
          <Box>
            <Typography variant="body2" color="text.secondary" gutterBottom>Vista previa:</Typography>
            <Box
              component="img"
              src={form.image}
              alt="preview"
              sx={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
              onError={(e: any) => { e.target.style.display = 'none'; }}
            />
          </Box>
        )}

        <FormControlLabel
          control={
            <Switch
              checked={form.available}
              onChange={(e) => handleChange('available', e.target.checked)}
              color="primary"
            />
          }
          label="Producto activo (visible en el menú)"
        />

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={submitting || !form.name || !form.categoryId || !form.price}
          >
            {submitting ? 'Guardando...' : initialData ? 'Actualizar producto' : 'Crear producto'}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}
