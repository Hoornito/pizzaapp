import type { CapacitorConfig } from '@capacitor/cli';

/**
 * La app nativa no reimplementa nada: abre el mismo sitio de producción adentro
 * de un WebView, y le suma lo que la web no puede hacer sola (push nativo,
 * splash, ícono en el cajón de apps, barra de estado).
 *
 * Por qué `server.url` y no un bundle local: la web es SSR (Next con server
 * propio, Prisma, sockets), no se puede exportar a archivos estáticos. Ventaja
 * grande: al publicar un cambio en el server, la app se actualiza sola, sin
 * tener que subir una versión nueva a las tiendas.
 *
 * Para probar contra la máquina de desarrollo:
 *   MOBILE_SERVER_URL=http://192.168.0.10:3000 npm run sync --workspace=apps/mobile
 */
const SERVER_URL = process.env.MOBILE_SERVER_URL || 'https://pizzacambalache.com.ar';
const esLocal = SERVER_URL.startsWith('http://');

const config: CapacitorConfig = {
  appId: 'ar.com.pizzacambalache.app',
  appName: 'Pizzería Cambalache',
  webDir: 'www',

  server: {
    url: SERVER_URL,
    // Sólo para apuntar a la PC en desarrollo; en producción va todo por HTTPS.
    cleartext: esLocal,
    androidScheme: 'https',
    // Pantalla propia cuando el celular se queda sin internet (www/error.html).
    errorPath: 'error.html',
    // Dominios a los que el WebView puede navegar sin salir a Chrome/Safari.
    // Mercado Pago tiene que estar sí o sí: el checkout redirige ahí.
    allowNavigation: [
      'pizzacambalache.com.ar',
      '*.pizzacambalache.com.ar',
      '*.mercadopago.com',
      '*.mercadopago.com.ar',
      '*.mercadolibre.com',
      '*.mercadolibre.com.ar',
    ],
  },

  // La web lo lee para saber que corre adentro de la app (ver src/lib/native.ts
  // en apps/web) y para poder distinguirlo en los logs del server.
  appendUserAgent: 'PizzaCambalacheApp',

  android: {
    allowMixedContent: esLocal,
  },

  ios: {
    contentInset: 'never',
    // En false para poder navegar a Mercado Pago desde el WebView.
    limitsNavigationsToAppBoundDomains: false,
  },

  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#FBF3E2',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#C62828',
    },
  },
};

export default config;
