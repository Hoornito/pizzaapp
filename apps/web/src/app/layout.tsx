import type { Metadata, Viewport } from 'next';
import { Roboto } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const roboto = Roboto({
  weight: ['300', '400', '500', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-roboto',
});

export const metadata: Metadata = {
  title: {
    default: 'Pizzería Cambalache',
    template: '%s | Pizzería Cambalache',
  },
  description: 'Pizza a la piedra · San Vicente',
  applicationName: 'Cambalache',
  icons: {
    icon: '/logo.png',
    apple: '/icons/apple-touch-icon.png',
  },
  // Instalable desde el navegador (el manifest lo genera src/app/manifest.ts) y
  // en pantalla completa al agregarla a la pantalla de inicio del iPhone.
  appleWebApp: {
    capable: true,
    title: 'Cambalache',
    statusBarStyle: 'default',
  },
  // Evita que iOS convierta números de pedido y precios en links de teléfono.
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#C62828',
  // Que el fondo llegue hasta los bordes en celulares con notch; el contenido se
  // separa con las safe-area de globals.css.
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={roboto.variable} suppressHydrationWarning>
        <div id="__next">
          <Providers>{children}</Providers>
        </div>
      </body>
    </html>
  );
}
