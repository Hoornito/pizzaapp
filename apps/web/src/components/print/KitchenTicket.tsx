'use client';

import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import PrintIcon from '@mui/icons-material/Print';
import type { OrderWithRelations } from '@/types/order.types';
import { toNumber, formatDate, formatOrderPayment } from '@/lib/utils';
import { DeliveryMapQR } from '@/components/orders/DeliveryMapQR';

interface KitchenTicketProps {
  order: OrderWithRelations;
}

export function KitchenTicket({ order }: KitchenTicketProps) {
  const handlePrint = () => window.print();

  return (
    <Box>
      <Box className="no-print" sx={{ mb: 2 }}>
        <Button variant="contained" startIcon={<PrintIcon />} onClick={handlePrint}>
          Imprimir Ticket
        </Button>
      </Box>

      <Box
        sx={{
          fontFamily: '"Courier New", monospace',
          fontSize: '12px',
          width: '80mm',
          p: '4mm',
          '@media print': {
            width: '80mm',
            p: '2mm',
          },
        }}
      >
        <Box sx={{ textAlign: 'center', mb: 1 }}>
          <Box sx={{ fontSize: '16px', fontWeight: 700 }}>🍕 PIZZERÍA</Box>
          <Box sx={{ borderTop: '1px dashed #000', my: 0.5 }} />
          <Box sx={{ fontWeight: 700, fontSize: '15px' }}>PEDIDO #{order.orderNumber}</Box>
          <Box sx={{ fontSize: '11px' }}>{formatDate(order.createdAt)}</Box>
        </Box>

        <Box sx={{ borderTop: '1px dashed #000', my: 1 }} />

        <Box sx={{ fontSize: '11px', mb: 1 }}>
          <Box><strong>Cliente:</strong> {order.user.name}</Box>
          {(order.phone || order.user.phone) && (
            <Box><strong>Tel:</strong> {order.phone || order.user.phone}</Box>
          )}
          <Box><strong>Tipo:</strong> {order.deliveryType === 'DELIVERY' ? '🛵 DELIVERY' : '🏪 RETIRO'}</Box>
          {order.address && (
            <Box>
              <strong>Dir:</strong>{' '}
              {order.address.street} {order.address.number}
              {order.address.apartment ? ` ${order.address.apartment}` : ''},{' '}
              {order.address.city}
            </Box>
          )}
          {order.address?.reference && (
            <Box><strong>Ref:</strong> {order.address.reference}</Box>
          )}
        </Box>

        <Box sx={{ borderTop: '1px dashed #000', my: 1 }} />

        <Box sx={{ fontWeight: 700, mb: 0.5 }}>DETALLE:</Box>
        {order.items.map((item) => (
          <Box key={item.id} sx={{ mb: 0.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Box>{item.quantity}x {item.product?.name || item.promotion?.name}</Box>
              <Box>${toNumber(item.subtotal).toLocaleString('es-AR')}</Box>
            </Box>
            {item.notes && (
              <Box sx={{ fontSize: '10px', color: '#555', pl: 2 }}>⚠️ {item.notes}</Box>
            )}
          </Box>
        ))}

        <Box sx={{ borderTop: '1px dashed #000', my: 1 }} />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <Box>Subtotal:</Box>
          <Box>${toNumber(order.subtotal).toLocaleString('es-AR')}</Box>
        </Box>
        {toNumber(order.deliveryFee) > 0 && (
          <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
            <Box>Envío:</Box>
            <Box>${toNumber(order.deliveryFee).toLocaleString('es-AR')}</Box>
          </Box>
        )}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '14px', mt: 0.5 }}>
          <Box>TOTAL:</Box>
          <Box>${toNumber(order.total).toLocaleString('es-AR')}</Box>
        </Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
          <Box>Pago:</Box>
          <Box sx={{ textAlign: 'right' }}>{formatOrderPayment(order)}</Box>
        </Box>

        {order.notes && (
          <>
            <Box sx={{ borderTop: '1px dashed #000', my: 1 }} />
            <Box sx={{ fontWeight: 700 }}>OBS: {order.notes}</Box>
          </>
        )}

        {order.deliveryType === 'DELIVERY' && order.address && (
          <>
            <Box sx={{ borderTop: '1px dashed #000', my: 1 }} />
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 0.5 }}>
              <DeliveryMapQR address={order.address} size={120} caption="Escaneá para la ruta" />
            </Box>
          </>
        )}

        <Box sx={{ borderTop: '1px dashed #000', mt: 1, pt: 0.5, textAlign: 'center', fontSize: '10px' }}>
          ¡Gracias por su pedido!
        </Box>
      </Box>
    </Box>
  );
}
