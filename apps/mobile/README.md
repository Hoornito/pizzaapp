# apps/mobile — plan B: app nativa para las tiendas

> **Esto no está en uso.** La app oficial de Cambalache es la **PWA**: el mismo
> sitio de `apps/web`, que el cliente instala desde el navegador sin pasar por
> ninguna tienda. Ver [`docs/mobile-app.md`](../../docs/mobile-app.md).
>
> Esta carpeta queda como salida de emergencia, por si algún día hace falta
> estar listado en Google Play o en la App Store.

Envoltorio [Capacitor](https://capacitorjs.com) del sitio de `apps/web`. No hay
código de UI acá: abre `https://pizzacambalache.com.ar` en un WebView y aporta
lo nativo (ícono, splash, barra de estado y notificaciones push por FCM).

**No es un workspace de npm** a propósito: si lo fuera, cada `npm install` de la
raíz se bajaría todo Capacitor sin que nadie lo use. Se instala aparte:

```bash
cd apps/mobile
npm install

npx cap add android      # una sola vez
npx cap add ios          # una sola vez, en una Mac

npx cap sync             # tras tocar capacitor.config.ts
npx cap open android     # abre Android Studio
npx cap run android      # instala en el celular conectado
```

Para apuntar a la máquina de desarrollo en vez de producción:

```bash
MOBILE_SERVER_URL=http://192.168.0.10:3000 npx cap sync
```

El push nativo usa FCM y necesita `FCM_SERVICE_ACCOUNT_JSON` en el server; el
código del envío ya está en `apps/web/src/lib/push/fcm.ts` y convive con el Web
Push de la PWA sin tocar nada.

## Qué NO se versiona

`android/` e `ios/` están en el `.gitignore`: se regeneran con `cap add`. Si en
algún momento hay cambios hechos a mano adentro (canal de notificaciones,
íconos), conviene empezar a versionarlos — **menos el keystore de firma, que no
va al repo nunca**.
