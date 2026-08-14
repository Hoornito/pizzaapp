'use client';

import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import { ImageUploadField } from '@/components/admin/ImageUploadField';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { useSnackbar } from '@/app/snackbar-context';
import { MENU_CARDS, type MenuCardKey } from '@/lib/constants';

type Images = Partial<Record<MenuCardKey, string>>;

/**
 * Fotos de las tarjetas del menú que no son un producto ni una promo, así que
 * no tienen ficha propia donde cargarlas (mitad y mitad, empanadas sueltas).
 */
export default function MenuImagesPage() {
  const { showSuccess, showError } = useSnackbar();
  const [images, setImages] = useState<Images>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings/menu-images', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => setImages(d.data || {}))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      // Mandamos todas las claves (con '' las que se vaciaron) para que el
      // servidor sepa cuáles borrar y cuáles dejar.
      const payload = Object.fromEntries(MENU_CARDS.map((c) => [c.key, images[c.key] ?? '']));
      const res = await fetch('/api/settings/menu-images', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) { showError(json.error || 'No se pudo guardar'); return; }
      setImages(json.data || {});
      showSuccess('Imágenes guardadas ✓');
    } catch {
      showError('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Cargando imágenes..." />;

  return (
    <Paper sx={{ p: 3, maxWidth: 620 }}>
      <Typography variant="h6" fontWeight={700} gutterBottom>Imágenes del menú</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Estas tarjetas se arman eligiendo varios productos, así que no tienen ficha propia.
        Las fotos del resto se cargan desde <strong>Productos</strong> y <strong>Promociones</strong>.
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {MENU_CARDS.map((card) => (
          <Box key={card.key}>
            <Typography variant="subtitle2" fontWeight={700} gutterBottom>{card.label}</Typography>
            <ImageUploadField
              label="Imagen"
              value={images[card.key] ?? ''}
              onChange={(url) => setImages((prev) => ({ ...prev, [card.key]: url }))}
              placeholder="Subí un archivo o pegá una URL"
            />
            {!images[card.key] && (
              <Typography variant="caption" color="text.secondary">
                Sin foto propia: se usa la de por defecto.
              </Typography>
            )}
            <Divider sx={{ mt: 2 }} />
          </Box>
        ))}
      </Box>

      <Button variant="contained" onClick={save} disabled={saving} sx={{ mt: 2 }}>
        {saving ? 'Guardando…' : 'Guardar imágenes'}
      </Button>
    </Paper>
  );
}
