import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Sin `output: 'standalone'`: usamos un server custom (server.ts) que sirve el
  // build normal de `.next`. El modo standalone rompía los clientReferenceManifest
  // de las páginas al correr con server custom.
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
  // La home '/' redirige a /menu a nivel de routing (antes de renderizar). Se hace
  // acá y no con una page que llame a redirect(), porque esa page —envuelta en el
  // layout cliente— dispara el bug "clientReferenceManifest" con el server custom.
  async redirects() {
    return [{ source: '/', destination: '/menu', permanent: false }];
  },
};

export default nextConfig;
