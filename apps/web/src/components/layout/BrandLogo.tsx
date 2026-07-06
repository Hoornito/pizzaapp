'use client';

import { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

interface BrandLogoProps {
  size?: number;
  showText?: boolean;
  /** Color del texto del nombre. */
  textColor?: string;
  variant?: 'h6' | 'h5' | 'h4' | 'h3';
}

/**
 * Logo de la marca. Usa /logo.png (guardá ahí el logo de la pizzería). Si el
 * archivo no está, cae a un emoji 🍕 para no romper la vista.
 */
export function BrandLogo({ size = 40, showText = true, textColor = 'inherit', variant = 'h6' }: BrandLogoProps) {
  const [failed, setFailed] = useState(false);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {failed ? (
        <Box component="span" sx={{ fontSize: size * 0.8, lineHeight: 1 }}>🍕</Box>
      ) : (
        <Box
          component="img"
          src="/logo.png"
          alt="Pizzería Cambalache"
          onError={() => setFailed(true)}
          sx={{ width: size, height: size, objectFit: 'contain', display: 'block' }}
        />
      )}
      {showText && (
        <Typography variant={variant} fontWeight={800} sx={{ color: textColor, whiteSpace: 'nowrap', letterSpacing: 0.2 }}>
          Pizzería Cambalache
        </Typography>
      )}
    </Box>
  );
}
