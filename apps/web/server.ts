import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { initSocketServer } from './src/lib/socket-server';
import { initNotificationListeners } from './src/services/notification.service';
import { cancelStaleUnpaidMercadoPagoOrders } from './src/services/order.service';

// Cada cuánto corre el cleanup y a partir de qué antigüedad cancela los
// pedidos de MercadoPago que quedaron esperando pago (configurable por env).
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const MP_PENDING_MAX_AGE_MIN = parseInt(process.env.MP_PENDING_MAX_AGE_MIN || '30', 10);

const dev = process.env.NODE_ENV !== 'production';
const hostname = process.env.HOSTNAME || 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error('Error handling request:', req.url, err);
      res.statusCode = 500;
      res.end('Internal server error');
    }
  });

  initSocketServer(httpServer);
  initNotificationListeners();

  // Cleanup periódico de pedidos MercadoPago abandonados (sin pago acreditado).
  const runCleanup = async () => {
    try {
      const { cancelled } = await cancelStaleUnpaidMercadoPagoOrders(MP_PENDING_MAX_AGE_MIN);
      if (cancelled > 0) console.log(`[cleanup] ${cancelled} pedido(s) MP sin pago cancelado(s)`);
    } catch (err) {
      console.error('[cleanup] Error:', err);
    }
  };
  setInterval(runCleanup, CLEANUP_INTERVAL_MS);
  void runCleanup();

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port} [${process.env.NODE_ENV}]`);
  });
});
