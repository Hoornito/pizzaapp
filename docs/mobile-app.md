# App móvil sin tiendas: PWA instalable + notificaciones push

La app de Cambalache **es el mismo sitio web**. El cliente lo agrega a la
pantalla de inicio del celular y le queda un ícono igual al de cualquier otra
app: se abre en pantalla completa, sin barra de navegador, y recibe
notificaciones cuando cambia el estado del pedido.

No hay que registrar nada en Google Play ni en la App Store.

## Por qué PWA y no publicar en las tiendas

|  | PWA (lo que hacemos) | Google Play + App Store |
|---|---|---|
| Costo | **$0** | USD 25 una vez + USD 99 por año |
| Equipo | Ninguno | Una **Mac** para poder compilar iOS |
| Revisión | No existe | 1 a 7 días en Play, 24 a 48 hs en Apple, con riesgo de rechazo |
| Trámites | Ninguno | Verificación de identidad, política de privacidad, formularios de datos, content rating |
| Testing obligatorio | No | Play le exige 12 testers durante 14 días a cuentas personales nuevas |
| Publicar un cambio | `git pull` en el server y listo | Subir una versión nueva y esperar revisión |
| Notificaciones push | **Sí**, Android y iOS 16.4+ | Sí |
| Instalación | El cliente toca "Instalar" en el navegador | Se busca en la tienda |

Lo que se resigna es **estar listado en las tiendas**. Para una pizzería que
reparte el link por WhatsApp, Instagram y un QR en el mostrador, pesa poco: el
cliente llega igual, y encima sin los 80 MB de descarga.

Si algún día hace falta la presencia en las tiendas, el envoltorio Capacitor
quedó armado en [`apps/mobile`](../apps/mobile/README.md) — ver el último
apartado.

## Qué se agregó al repo

| Archivo / carpeta | Para qué |
|---|---|
| `apps/web/src/app/manifest.ts` | Manifest: nombre, ícono, colores, arranque en `/menu` |
| `apps/web/public/sw.js` | Service worker: push + pantalla de sin conexión |
| `apps/web/public/offline.html` | Lo único que se cachea (estático, nunca queda viejo) |
| `apps/web/public/icons/` | Íconos 192/512, maskable y apple-touch, generados del logo |
| `apps/web/src/lib/pwa.ts` | Detección de "instalada", de iPhone y registro del SW |
| `apps/web/src/components/pwa/` | `PwaSetup` (registra el SW) e `InstallPrompt` (invita a instalar) |
| `PushDevice` en `schema.prisma` | Un registro por celular/navegador suscripto |
| `apps/web/src/lib/push/` | Envío: Web Push VAPID (PWA) y FCM (por si algún día hay app nativa) |
| `apps/web/src/services/push.service.ts` | Alta/baja de dispositivos y textos por estado |
| `apps/web/src/app/api/push/*` | `register`, `unregister`, `test` |
| `apps/web/src/components/notifications/` | `PushSetup` (global), `PushOptIn` (Mis pedidos), `PushToggle` (perfil) |

Nada de esto rompe la web común: **si no hay claves de push cargadas no se manda
nada**, y el aviso sigue yendo por mail, WhatsApp y socket como siempre. El
service worker **no cachea la app** — es SSR, y un cache mal invalidado deja al
cliente viendo precios viejos.

## Cómo funciona la notificación

1. El cliente activa los avisos: cartel en **Mis pedidos**, interruptor en
   **Perfil**, o el permiso que pide el navegador.
2. El navegador devuelve una suscripción VAPID que se guarda en `PushDevice`
   atada al usuario.
3. El local cambia el estado del pedido → `updateOrderStatus` emite
   `order:status_changed` en el event bus.
4. `notification.service.ts` llama a `sendOrderStatusPush`, que manda a **todos**
   los dispositivos activos del cliente y deja el aviso en `Notification`.
5. Tocar la notificación abre `/orders`.

Estados que se notifican: `CONFIRMADO`, `PREPARANDO`, `EN_HORNO`, `LISTO`,
`EN_REPARTO`, `ENTREGADO`, `CANCELADO`. `PENDIENTE_PAGO` y `RECIBIDO` no: el
cliente recién hizo el pedido y está mirando la pantalla.

Las suscripciones muertas se marcan `active = false` solas cuando el navegador
responde 404/410.

---

## Puesta en marcha

### 1. Claves VAPID

```bash
npm run push:vapid --workspace=apps/web
```

Pegar las tres líneas que imprime en el `.env` de producción. La privada **no**
va al repo ni al cliente. Ya quedaron generadas unas de desarrollo en
`apps/web/.env`; **para producción hay que generar otras**.

### 2. Migración

```bash
npm run db:migrate --workspace=apps/web   # crea la tabla PushDevice
```

En producción, la migración `20260818120000_push_devices` entra con el
`prisma migrate deploy` del arranque.

### 3. HTTPS

Obligatorio para service workers y para push. Ya está resuelto: Caddy sirve
`pizzacambalache.com.ar` con certificado. En local funciona igual en
`http://localhost` (los navegadores lo tratan como origen seguro), pero **no**
en `http://192.168.x.x` — para probar desde el celular en la red hace falta el
túnel de Cloudflare.

### 4. Probar

Logueado: **Perfil → Avisos del pedido → activar → Mandar una de prueba**. O
mover un pedido de prueba de estado desde el panel.

Conviene además pasar Lighthouse (DevTools → Lighthouse → *Progressive Web App*)
para confirmar que el manifest y el service worker están bien tomados.

## Cómo la instala el cliente

**Android / Chrome.** Aparece solo el cartel *"Instalá Cambalache en tu
celular"* (`InstallPrompt`), y Chrome además ofrece "Agregar a pantalla
principal" desde su menú. Un toque y queda el ícono.

**iPhone / Safari.** No existe la instalación automática: hay que tocar
**Compartir → Agregar a inicio**. El cartel lo explica con los pasos, y en el
perfil también, porque en iOS **es obligatorio instalar para recibir push** —
Safari no notifica a un sitio abierto en una pestaña común. Requiere iOS 16.4 o
superior.

**Escritorio.** Chrome y Edge muestran el ícono de instalar en la barra de
direcciones. Sirve para la compu del local.

### Difundirla

Un QR al menú pegado en el mostrador y en las cajas, el link fijado en el perfil
de Instagram, y en la respuesta automática de WhatsApp. La primera vez que
entran, el cartel de instalar hace el resto.

## Limitaciones que conviene tener presentes

- **iOS 16.4+ y sólo instalada.** Un iPhone viejo o un cliente que no agregó el
  sitio a inicio no recibe push. Le siguen llegando el mail y el WhatsApp, que ya
  estaban.
- **iOS pide el permiso recién ahí**: hasta que no se instala, el botón de
  activar no aparece (está contemplado en la UI, no muestra controles muertos).
- **No se busca en la tienda.** El cliente tiene que llegar por un link o un QR.
- **Si el server se cae, la app se cae con él.** Muestra la pantalla de
  `offline.html` con el WhatsApp como salida.
- **El cliente puede borrar los datos del navegador** y perder la suscripción.
  Se vuelve a registrar sola la próxima vez que entra, porque `PushSetup`
  re-registra cuando el permiso ya estaba dado.

## Plan B: las tiendas, si alguna vez hacen falta

En [`apps/mobile`](../apps/mobile/README.md) quedó un proyecto Capacitor que
envuelve este mismo sitio en una app nativa, con push por FCM. No está en uso ni
es un workspace de npm, así que no molesta ni suma dependencias.

Lo que haría falta el día que se active:

- **Google Play**: USD 25 una vez, keystore propio (si se pierde no se puede
  volver a publicar), AAB firmado, ícono 512, gráfico 1024×500, 2 capturas,
  política de privacidad publicada y el formulario de seguridad de los datos.
  Ojo con los 12 testers × 14 días de las cuentas personales nuevas: con cuenta
  de organización no aplica.
- **App Store**: USD 99 por año, una Mac con Xcode, ícono 1024 sin alfa,
  capturas 6.7" y 6.5", política de privacidad y una cuenta de prueba para el
  revisor. Riesgo concreto de rechazo por la guideline 4.2 ("es sólo un sitio
  web"); el push nativo es la principal defensa.
- **Firebase** para el push nativo: `google-services.json` en Android, la APNs
  Auth Key `.p8` en iOS, y el JSON de la service account en
  `FCM_SERVICE_ACCOUNT_JSON` del server. El código de envío ya está escrito y
  convive con el Web Push sin tocar nada.
