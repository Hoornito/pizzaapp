import type { Metadata } from 'next';
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
  icons: { icon: '/logo.png' },
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
