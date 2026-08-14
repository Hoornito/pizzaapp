'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

interface ImageUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  label?: string;
  placeholder?: string;
}

/**
 * Campo de imagen para las fichas del admin: se puede pegar una URL o subir un
 * archivo desde la compu/celular. Lo subido queda en el volumen de uploads y se
 * sirve por /api/uploads/<archivo>.
 */
export function ImageUploadField({
  value,
  onChange,
  label = 'Imagen',
  placeholder = 'https://... o subí un archivo',
}: ImageUploadFieldProps) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

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
      onChange(json.data.url);
    } catch {
      setUploadError('Error de conexión al subir la imagen');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <TextField
          label={label}
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          sx={{ flex: 1, minWidth: 240 }}
          placeholder={placeholder}
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

      {value && (
        <Box sx={{ mt: 1 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>Vista previa:</Typography>
          <Box
            component="img"
            src={value}
            alt="preview"
            sx={{ width: 120, height: 120, objectFit: 'cover', borderRadius: 2, border: '1px solid', borderColor: 'divider' }}
            onError={(e: any) => { e.target.style.display = 'none'; }}
          />
        </Box>
      )}
    </Box>
  );
}
