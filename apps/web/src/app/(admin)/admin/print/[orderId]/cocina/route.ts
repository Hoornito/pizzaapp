import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import { isPizzaItemNotes } from '@/lib/pizza';
import QRCode from 'qrcode';
import { parseOrderCustomer, groupTicketItems, buildWazeUrl } from '@/lib/utils';
import { ORDER_PAYMENT_METHOD_LABELS } from '@/lib/constants';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

/**
 * Ticket de COCINA — hoja A6 (10,5 × 14,8 cm), impresora láser. Es route handler
 * (no page) para devolver un documento HTML limpio, sin el layout del admin.
 * Lo lleva también el repartidor: incluye total y estado de pago. Las docenas
 * de empanadas se imprimen sin título, sólo la cantidad de cada gusto.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ orderId: string }> }) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return new Response('No autorizado', { status: 401 });
  }

  const { orderId } = await params;
  const qzMode = new URL(req.url).searchParams.get('print') === 'qz';

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      user: { select: { name: true, phone: true, role: true } },
      items: { include: { product: { select: { name: true } }, promotion: { select: { name: true } } } },
      address: true,
    },
  });
  if (!order) return new Response('Pedido no encontrado', { status: 404 });

  const fmtMoney = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
  const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));

  // Agrupamos ítems idénticos (2 pizzas iguales -> "2x ..."). Las mitad-y-mitad
  // tienen notas distintas, así que quedan como líneas aparte.
  const itemsHtml = groupTicketItems(order.items, isPizzaItemNotes)
    .map((g) => {
      if (g.isDozen) {
        // Sólo la cantidad de cada gusto, sin título.
        return `<div class="item"><div class="item-notes big">${esc(g.notes)}</div></div>`;
      }
      const notes = !g.isPizza && g.notes ? `<div class="item-notes">${esc(g.notes)}</div>` : '';
      return `<div class="item"><div class="item-title">${esc(g.quantity)}x ${esc(g.title)}</div>${notes}</div>`;
    })
    .join('');

  // El include de arriba no trae payment; lo consultamos aparte para el estado.
  const payment = await prisma.payment.findUnique({ where: { orderId }, select: { status: true } });
  const isPaid = payment?.status === 'APPROVED';
  const methodLabel = ORDER_PAYMENT_METHOD_LABELS[order.paymentMethod] || order.paymentMethod;
  const { customerName, cleanNotes } = parseOrderCustomer(
    order.notes,
    order.user?.role === 'ADMIN' ? null : order.user?.name
  );

  // QR de Waze hacia la dirección (solo delivery). Lo lleva el repartidor.
  const wazeQr =
    order.deliveryType === 'DELIVERY' && order.address
      ? await QRCode.toDataURL(buildWazeUrl(order.address), { margin: 1, width: 220 })
      : null;

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>Cocina #${esc(order.orderNumber)}</title>
<style>
  /* La hoja se imprime APAISADA (A6 horizontal, como la agarra la impresora),
     pero el contenido va rotado 90° para leerse en VERTICAL. El bloque .content
     es un A6 vertical (105×148) rotado y centrado, que rellena la hoja apaisada
     (148×105). Si sale girado para el otro lado, cambiar rotate(-90deg) → 90deg. */
  /* Papel físico A6 (aunque el driver esté en A5 porque no ofrece A6). El
     contenido se dimensiona para A6 apaisado (148×105), con la caja vertical
     105×148 rotada -90°. Fuentes tamaño A6 (como imprimía bien). */
  @page { size: 148mm 105mm; margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; }
  html, body { width: 148mm; height: 105mm; overflow: hidden; }
  .content {
    position: absolute; top: 50%; left: 50%;
    width: 105mm; height: 148mm;
    transform: translate(-50%, -50%) rotate(-90deg);
    transform-origin: center center;
    padding: 6mm;
    font-family: Arial, Helvetica, sans-serif; font-size:13px; color:#000; line-height:1.3;
  }
  .header { font-size:20px; font-weight:bold; text-align:center; }
  .sub { font-size:11px; text-align:center; }
  .sep { border-top:2px solid #000; margin:5px 0; }
  .meta { font-size:12px; margin:4px 0; }
  .item { margin-bottom:8px; }
  .item-title { font-size:14px; font-weight:bold; }
  .item-notes { font-size:12px; padding-left:6mm; white-space:pre-line; }
  .item-notes.big { font-size:15px; font-weight:bold; padding-left:0; }
  .pay { margin-top:4px; }
  .total { font-size:17px; font-weight:bold; display:flex; justify-content:space-between; }
  .status { margin-top:3px; text-align:center; font-weight:bold; padding:3px; border:2px solid #000; }
  .status.unpaid { background:#000; color:#fff; }
  .qr { text-align:center; margin-top:6px; }
  .qr img { width:26mm; height:26mm; }
  .qr-label { font-size:11px; font-weight:bold; }
  @media print { body { -webkit-print-color-adjust:exact; } }
</style></head>
<body>
  <div class="content">
  <div class="header">COCINA · PEDIDO #${esc(order.orderNumber)}</div>
  <div class="sub">${esc(fmtDate(order.createdAt))}</div>
  <div class="sep"></div>
  <div class="meta">
    <div><b>Tipo:</b> ${order.deliveryType === 'DELIVERY' ? 'DELIVERY 🛵' : 'RETIRO EN LOCAL 🏪'}</div>
    ${customerName ? `<div><b>Cliente:</b> ${esc(customerName)}</div>` : ''}
    ${order.phone || order.user?.phone ? `<div><b>Tel:</b> ${esc(order.phone || order.user?.phone)}</div>` : ''}
    ${order.deliveryType === 'DELIVERY' && order.address ? `<div><b>Dirección:</b> ${esc(order.address.street)} ${esc(order.address.number)}${order.address.apartment ? ' ' + esc(order.address.apartment) : ''}, ${esc(order.address.city)}</div>` : ''}
  </div>
  <div class="sep"></div>
  ${itemsHtml}
  <div class="sep"></div>
  <div class="pay">
    <div class="total"><span>TOTAL</span><span>${esc(fmtMoney(Number(order.total)))}</span></div>
    <div class="status ${isPaid ? 'paid' : 'unpaid'}">
      ${isPaid ? `PAGADO ✓ (${esc(methodLabel)})` : `FALTA COBRAR · ${esc(methodLabel)}`}
    </div>
  </div>
  ${cleanNotes ? `<div class="sep"></div><div class="meta"><b>Obs:</b> ${esc(cleanNotes)}</div>` : ''}
  ${wazeQr ? `<div class="sep"></div><div class="qr"><img src="${wazeQr}" alt="Waze" /><div class="qr-label">Escaneá para ir con Waze</div></div>` : ''}
  </div>
  ${qzMode ? '' : '<script>window.onload=function(){window.print();}</script>'}
</body></html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
