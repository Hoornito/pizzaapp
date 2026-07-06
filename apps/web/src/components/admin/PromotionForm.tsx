'use client';

import { useState, useEffect } from 'react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Divider from '@mui/material/Divider';

interface PromotionFormProps {
  initialData?: any;
  onSubmit: (data: any) => Promise<void>;
}

interface PromotionItem {
  productId: string;
  quantity: number;
}

export function PromotionForm({ initialData, onSubmit }: PromotionFormProps) {
  const [products, setProducts] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: initialData?.name || '',
    description: initialData?.description || '',
    promotionalPrice: initialData?.promotionalPrice?.toString() || '',
    image: initialData?.image || '',
    available: initialData?.available ?? true,
    startDate: initialData?.startDate ? new Date(initialData.startDate).toISOString().slice(0, 16) : '',
    endDate: initialData?.endDate ? new Date(initialData.endDate).toISOString().slice(0, 16) : '',
  });
  const [items, setItems] = useState<PromotionItem[]>(
    initialData?.items?.map((i: any) => ({ productId: i.productId, quantity: i.quantity })) || [{ productId: '', quantity: 1 }]
  );

  useEffect(() => {
    fetch('/api/products?limit=100')
      .then((r) => r.json())
      .then((d) => setProducts(d.data || []));
  }, []);

  const handleChange = (field: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [field]: value }));
  };

  const addItem = () => setItems((prev) => [...prev, { productId: '', quantity: 1 }]);
  const removeItem = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, value: any) => {
    setItems((prev) => prev.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await onSubmit({
        name: form.name,
        description: form.description || undefined,
        promotionalPrice: parseFloat(form.promotionalPrice),
        image: form.image || undefined,
        available: form.available,
        startDate: form.startDate || undefined,
        endDate: form.endDate || undefined,
        items: items.filter((i) => i.productId),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Paper sx={{ p: 3, maxWidth: 700 }}>
      <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <TextField
          label="Nombre *"
          value={form.name}
          onChange={(e) => handleChange('name', e.target.value)}
          required
          fullWidth
        />

        <TextField
          label="Descripción"
          value={form.description}
          onChange={(e) => handleChange('description', e.target.value)}
          multiline
          rows={2}
          fullWidth
        />

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <TextField
            label="Precio promocional ($) *"
            type="number"
            inputProps={{ min: 0, step: '0.01' }}
            value={form.promotionalPrice}
            onChange={(e) => handleChange('promotionalPrice', e.target.value)}
            required
            fullWidth
          />
          <TextField
            label="URL de imagen"
            value={form.image}
            onChange={(e) => handleChange('image', e.target.value)}
            fullWidth
          />
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <TextField
            label="Válida desde"
            type="datetime-local"
            value={form.startDate}
            onChange={(e) => handleChange('startDate', e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="Válida hasta"
            type="datetime-local"
            value={form.endDate}
            onChange={(e) => handleChange('endDate', e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
        </Box>

        <Divider />

        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" fontWeight={600}>Productos incluidos *</Typography>
            <Button size="small" onClick={addItem}>+ Agregar producto</Button>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {items.map((item, i) => (
              <Box key={i} sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Producto</InputLabel>
                  <Select
                    value={item.productId}
                    label="Producto"
                    onChange={(e) => updateItem(i, 'productId', e.target.value)}
                  >
                    {products.map((p) => (
                      <MenuItem key={p.id} value={p.id}>{p.name} ({p.category?.name})</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <TextField
                  label="Cant."
                  type="number"
                  size="small"
                  inputProps={{ min: 1, max: 99 }}
                  value={item.quantity}
                  onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))}
                  sx={{ width: 90 }}
                />
                {items.length > 1 && (
                  <IconButton size="small" color="error" onClick={() => removeItem(i)}>✕</IconButton>
                )}
              </Box>
            ))}
          </Box>
        </Box>

        <FormControlLabel
          control={
            <Switch
              checked={form.available}
              onChange={(e) => handleChange('available', e.target.checked)}
              color="primary"
            />
          }
          label="Promoción activa"
        />

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            type="submit"
            variant="contained"
            size="large"
            disabled={submitting || !form.name || !form.promotionalPrice || items.every((i) => !i.productId)}
          >
            {submitting ? 'Guardando...' : initialData ? 'Actualizar promoción' : 'Crear promoción'}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}
