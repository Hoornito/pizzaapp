'use client';

import Box from '@mui/material/Box';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import { usePathname, useRouter } from 'next/navigation';

/**
 * Secciones de Configuración. Sin esto no había forma de llegar a ellas.
 *
 * Zonas y Envío quedan fuera del menú por ahora (el envío es sin cargo y la
 * zona de reparto está fija en San Vicente). Las páginas siguen en el código:
 * para volver a mostrarlas, descomentar las líneas de abajo.
 */
const SECTIONS = [
  { href: '/admin/settings/hours', label: '🕒 Horarios' },
  { href: '/admin/settings/discounts', label: '🏷️ Descuentos' },
  { href: '/admin/settings/menu-images', label: '🖼️ Imágenes del menú' },
  { href: '/admin/settings/delivery-areas', label: '📍 Zonas de reparto' },
  // { href: '/admin/settings/zones', label: '📍 Zonas' },
  // { href: '/admin/settings/delivery', label: '🛵 Envío' },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const current = SECTIONS.find((s) => pathname.startsWith(s.href))?.href ?? SECTIONS[0].href;

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} sx={{ mb: 2 }}>Configuración</Typography>
      <Tabs
        value={current}
        onChange={(_, v) => router.push(v)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
      >
        {SECTIONS.map((s) => (
          <Tab key={s.href} value={s.href} label={s.label} sx={{ textTransform: 'none', fontWeight: 600 }} />
        ))}
      </Tabs>
      {children}
    </Box>
  );
}
