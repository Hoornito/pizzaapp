import { NextRequest } from 'next/server';
import { readFileSync } from 'fs';
import path from 'path';
import sharp from 'sharp';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { prisma } from '@/lib/prisma';
import { isPizzaItemNotes } from '@/lib/pizza';
import { formatOrderPayment, parseOrderCustomer, groupTicketItems } from '@/lib/utils';

const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));

// Logo en base64 (data URI) cacheado: así se imprime igual desde el navegador
// y desde QZ (que recibe el HTML como string suelto, sin poder resolver /logo.png).
// Se pre-procesa a gris + alto contraste para que la impresora térmica (POS-80)
// no lo imprima pálido/"dithered": el linework sale con fuerza de tinta.
let logoDataUri: string | null | undefined;
async function getLogoDataUri(): Promise<string | null> {
  if (logoDataUri === undefined) {
    try {
      const buf = readFileSync(path.join(process.cwd(), 'public', 'logo.png'));
      const processed = await sharp(buf)
        .flatten({ background: '#ffffff' }) // transparencia → blanco (papel)
        .grayscale() // sin color: evita el "dithering" de la térmica
        .linear(1.6, -80) // más contraste + más oscuro (pivote ~128)
        .png()
        .toBuffer();
      logoDataUri = `data:image/png;base64,${processed.toString('base64')}`;
    } catch {
      logoDataUri = null;
    }
  }
  return logoDataUri;
}

/**
 * Comanda del CLIENTE — ticket térmico (80 mm). Route handler (HTML limpio, sin
 * layout del admin). Muestra qué compró + precios; no detalla la composición
 * salvo en pizzas (una docena aparece como "1x Docena de Empanadas").
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
      payment: { select: { status: true } },
      items: { include: { product: { select: { name: true } }, promotion: { select: { name: true } } } },
      address: true,
    },
  });
  if (!order) return new Response('Pedido no encontrado', { status: 404 });

  const fmtMoney = (n: number) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(n);
  const fmtDate = (d: Date) =>
    new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(d));

  const itemsHtml = groupTicketItems(order.items, isPizzaItemNotes)
    .map((g) => {
      const base = g.isPizza ? g.notes : g.title;
      const name = g.extra ? `${base} ${g.extra}` : base;
      return `<div class="item-row"><span class="item-name">${esc(g.quantity)}x ${esc(name)}</span><span class="item-price">${esc(fmtMoney(g.unitPrice * g.quantity))}</span></div>`;
    })
    .join('');

  const isPaid = order.payment?.status === 'APPROVED';
  // En pedidos de mostrador (creados por un admin) no usamos el nombre del admin
  // como fallback: si no se cargó un cliente, la línea queda vacía.
  const { customerName, cleanNotes } = parseOrderCustomer(
    order.notes,
    order.user?.role === 'ADMIN' ? null : order.user?.name
  );
  const logo = await getLogoDataUri();

  const html = `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8"><title>Comanda #${esc(order.orderNumber)}</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { margin:0; padding:0; box-sizing:border-box; }
  /* Ancho 72mm (área imprimible real de la POS-80; a 80mm se recortaba el borde
     derecho). font-weight:bold en todo para que no salga clarito en la térmica. */
  body { font-family:'Courier New', monospace; font-size:12px; font-weight:bold; width:72mm; padding:2mm; color:#000; }
  .center { text-align:center; } .bold { font-weight:bold; } .large { font-size:16px; }
  .sep { border-top:1px dashed #000; margin:4px 0; }
  .item-row { display:flex; justify-content:space-between; margin:2px 0; }
  .item-name { flex:1; padding-right:6px; } .item-price { text-align:right; white-space:nowrap; }
  .total-row { display:flex; justify-content:space-between; font-weight:bold; font-size:14px; margin-top:4px; }
  .paid { text-align:center; font-weight:bold; margin-top:4px; }
  @media print { body { -webkit-print-color-adjust:exact; } }
</style></head>
<body>
  ${logo ? `<div class="center"><img src="${logo}" alt="Cambalache" style="width:44mm;height:auto;margin:0 auto 4px;display:block;-webkit-print-color-adjust:exact;print-color-adjust:exact" /></div>` : ''}
  <div class="center bold large">PIZZERÍA CAMBALACHE</div>
  <div class="center" style="font-size:10px;margin-bottom:8px">Pizza a la piedra · San Vicente</div>
  <div class="sep"></div>
  <div class="bold center large">PEDIDO #${esc(order.orderNumber)}</div>
  <div class="center" style="font-size:10px">${esc(fmtDate(order.createdAt))}</div>
  <div class="sep"></div>
  <div>
    ${customerName ? `<div><b>Cliente:</b> ${esc(customerName)}</div>` : ''}
    ${order.phone || order.user?.phone ? `<div><b>Tel:</b> ${esc(order.phone || order.user?.phone)}</div>` : ''}
    <div><b>Tipo:</b> ${order.deliveryType === 'DELIVERY' ? 'DELIVERY' : 'RETIRO EN LOCAL'}</div>
    <div><b>Pago:</b> ${esc(formatOrderPayment(order, { emoji: false }))}</div>
  </div>
  ${order.address ? `<div class="sep"></div><div><div class="bold">DIRECCIÓN:</div><div>${esc(order.address.street)} ${esc(order.address.number)}${order.address.apartment ? ' ' + esc(order.address.apartment) : ''}</div><div>${esc(order.address.city)}</div>${order.address.reference ? `<div>Ref: ${esc(order.address.reference)}</div>` : ''}</div>` : ''}
  <div class="sep"></div>
  <div class="bold" style="margin-bottom:4px">DETALLE:</div>
  ${itemsHtml}
  <div class="sep"></div>
  <div class="item-row"><span>Subtotal</span><span>${esc(fmtMoney(Number(order.subtotal)))}</span></div>
  <div class="item-row"><span>Envío</span><span>${Number(order.deliveryFee) > 0 ? esc(fmtMoney(Number(order.deliveryFee))) : 'GRATIS'}</span></div>
  <div class="total-row"><span>TOTAL</span><span>${esc(fmtMoney(Number(order.total)))}</span></div>
  <div class="paid">${isPaid ? 'PAGADO ✓' : 'PENDIENTE DE PAGO'}</div>
  ${cleanNotes ? `<div class="sep"></div><div><b>Obs:</b> ${esc(cleanNotes)}</div>` : ''}
  <div class="sep"></div>
  <div class="center" style="font-size:10px;margin-top:4px">¡Gracias por tu pedido!</div>
  ${qzMode ? '' : '<script>window.onload=function(){window.print();}</script>'}
</body></html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
