import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
  // Renombrado en Next 15: antes vivía en experimental.serverComponentsExternalPackages.
  serverExternalPackages: ['@prisma/client', 'prisma'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
      { protocol: 'http', hostname: 'localhost' },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  eslint: {
    // No frenamos el build de producción por reglas de lint (warnings de estilo,
    // imports sin usar, etc.). El chequeo de TIPOS de TypeScript sigue activo
    // (ver `typescript.ignoreBuildErrors: false`), que es la red de seguridad real.
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
