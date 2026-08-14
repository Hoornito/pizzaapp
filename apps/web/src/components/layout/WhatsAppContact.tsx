'use client';

import Box from '@mui/material/Box';
import Link from '@mui/material/Link';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { BUSINESS_WHATSAPP_DISPLAY, BUSINESS_WHATSAPP_LINK } from '@/lib/constants';

interface WhatsAppContactProps {
  /** `dark` para el pie (fondo oscuro); `light` para el menú. */
  tone?: 'dark' | 'light';
}

/**
 * Número de WhatsApp con su logo. Está arriba del menú y en el pie: es la vía
 * por la que la gente pregunta, así que no queremos que la tengan que buscar.
 */
export function WhatsAppContact({ tone = 'light' }: WhatsAppContactProps) {
  const dark = tone === 'dark';

  return (
    <Link
      href={BUSINESS_WHATSAPP_LINK}
      target="_blank"
      rel="noopener noreferrer"
      underline="none"
      aria-label={`Escribinos por WhatsApp al ${BUSINESS_WHATSAPP_DISPLAY}`}
      sx={{
        display: 'inline-flex', alignItems: 'center', gap: 1,
        color: dark ? 'grey.300' : 'text.primary',
        ...(dark
          ? { '&:hover': { color: '#25D366' } }
          : {
              px: 1.5, py: 0.75, borderRadius: 999,
              border: '1px solid', borderColor: 'divider',
              '&:hover': { borderColor: '#25D366', bgcolor: 'action.hover' },
            }),
      }}
    >
      <WhatsAppIcon sx={{ fontSize: 30, color: '#25D366' }} />
      <Box component="span" sx={{ fontWeight: 600 }}>{BUSINESS_WHATSAPP_DISPLAY}</Box>
    </Link>
  );
}
