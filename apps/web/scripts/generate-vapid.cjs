/**
 * Genera el par de claves VAPID para las notificaciones push de la web.
 * Se corre una sola vez:  npm run push:vapid --workspace=apps/web
 * Después se pegan las dos líneas en el .env (y en el .env del server).
 */
const webpush = require('web-push');

const { publicKey, privateKey } = webpush.generateVAPIDKeys();

console.log('\nPegá esto en tu .env:\n');
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY="${publicKey}"`);
console.log(`VAPID_PRIVATE_KEY="${privateKey}"`);
console.log('VAPID_SUBJECT="mailto:pedidos@pizzacambalache.com.ar"\n');
console.log('⚠️  La privada NO va al repo ni al cliente: sólo al .env del server.\n');
