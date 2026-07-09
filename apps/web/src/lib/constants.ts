export const APP_NAME = 'Pizzería Cambalache';
export const APP_DESCRIPTION = 'Pizza a la piedra · San Vicente';

export const ORDER_STATUS_FLOW = [
  'RECIBIDO',
  'CONFIRMADO',
  'LISTO',
  'EN_REPARTO',
  'ENTREGADO',
] as const;

export const ORDER_STATUS_LABELS: Record<string, string> = {
  PENDIENTE_PAGO: 'Pendiente de pago',
  RECIBIDO: 'Recibido',
  CONFIRMADO: 'Confirmado',
  PREPARANDO: 'Preparando',
  EN_HORNO: 'En horno',
  LISTO: 'Listo',
  EN_REPARTO: 'En reparto',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

export const ORDER_STATUS_COLORS: Record<string, string> = {
  PENDIENTE_PAGO: 'default',
  RECIBIDO: 'warning',
  CONFIRMADO: 'info',
  PREPARANDO: 'info',
  EN_HORNO: 'warning',
  LISTO: 'success',
  EN_REPARTO: 'primary',
  ENTREGADO: 'success',
  CANCELADO: 'error',
};

// Pasos que ve el cliente. Arrancan en "Confirmado": mientras el pedido está
// RECIBIDO (la cocina todavía no lo confirmó) ningún paso está activo y se ven
// todos en gris; al confirmarse, "Confirmado" se enciende.
export const ORDER_STATUS_STEPS = [
  'CONFIRMADO',
  'LISTO',
  'EN_REPARTO',
  'ENTREGADO',
];

// Para retiro en local no existe la etapa "En reparto".
export function orderStatusSteps(deliveryType?: string): string[] {
  if (deliveryType === 'PICKUP') {
    return ORDER_STATUS_STEPS.filter((s) => s !== 'EN_REPARTO');
  }
  return ORDER_STATUS_STEPS;
}

export const NEXT_STATUSES: Record<string, string[]> = {
  PENDIENTE_PAGO: ['CANCELADO'],
  RECIBIDO: ['CONFIRMADO', 'CANCELADO'],
  CONFIRMADO: ['LISTO', 'CANCELADO'],
  // Estados intermedios (legacy): igual pueden avanzar a LISTO o cancelarse,
  // así ningún pedido queda trabado sin acciones.
  PREPARANDO: ['LISTO', 'CANCELADO'],
  EN_HORNO: ['LISTO', 'CANCELADO'],
  LISTO: ['EN_REPARTO', 'ENTREGADO'],
  EN_REPARTO: ['ENTREGADO'],
  ENTREGADO: [],
  CANCELADO: [],
};

export const WHATSAPP_TOKEN_TTL_HOURS = 2;
export const WHATSAPP_TOKEN_REDIS_TTL = WHATSAPP_TOKEN_TTL_HOURS * 60 * 60;

export const RATE_LIMIT_API = { windowMs: 60_000, max: 100 };
export const RATE_LIMIT_AUTH = { windowMs: 60_000, max: 10 };
export const RATE_LIMIT_WHATSAPP = { windowMs: 60_000, max: 50 };

export const PAGINATION_DEFAULT_LIMIT = 20;
export const PAGINATION_MAX_LIMIT = 100;

export const CURRENCY = 'ARS';
export const CURRENCY_SYMBOL = '$';

export const DAYS_OF_WEEK = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

// ─── Finance ───────────────────────────────────────────────────────────────

export const FINANCE_INCOME_CATEGORIES = [
  'Inyección de caja',
  'Venta otros',
  'Ajuste de saldo',
] as const;

export const FINANCE_EXPENSE_CATEGORIES = [
  'Sueldos',
  'Adelantos',
  'Proveedores',
  'Servicios (Luz, Gas, etc.)',
  'Alquiler',
  'Retiro en sobre',
  'Gastos varios',
] as const;

// Categorías usadas en los reportes financieros
export const FINANCE_CATEGORY_SUELDOS = 'Sueldos';
export const FINANCE_CATEGORY_ADELANTOS = 'Adelantos';
export const FINANCE_CATEGORY_SOBRES = 'Retiro en sobre';
// Retiro del "dinero a favor" generado por la venta de postres (egreso en Finanzas).
export const FINANCE_CATEGORY_POSTRES = 'Retiro de postres';

export const FINANCE_PAYMENT_METHODS = ['EFECTIVO', 'TRANSFERENCIA', 'TARJETA'] as const;

export const CASH_SHIFTS = ['MANANA', 'NOCHE'] as const;

export const CASH_SHIFT_LABELS: Record<string, string> = {
  MANANA: 'Turno mañana',
  NOCHE: 'Turno noche',
};

export const FINANCE_PAYMENT_METHOD_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  TRANSFERENCIA: 'Transferencia',
  TARJETA: 'Tarjeta',
  // métodos provenientes de pedidos (Order.paymentMethod)
  MERCADO_PAGO: 'Mercado Pago',
  MIXTO: 'Mixto',
};

// Etiquetas e íconos para Order.paymentMethod (lo que elige el cliente al pagar)
export const ORDER_PAYMENT_METHOD_LABELS: Record<string, string> = {
  EFECTIVO: 'Efectivo',
  MERCADO_PAGO: 'Mercado Pago',
  MIXTO: 'Mixto',
  TRANSFERENCIA: 'Transferencia',
  TARJETA: 'QR o Tarjeta',
  A_DEFINIR: 'Paga al retirar',
};

export const ORDER_PAYMENT_METHOD_EMOJI: Record<string, string> = {
  EFECTIVO: '💵',
  MERCADO_PAGO: '💳',
  MIXTO: '🔀',
  TRANSFERENCIA: '🏦',
  TARJETA: '💳',
  A_DEFINIR: '⏳',
};

// Datos de transferencia (MOCK — reemplazar por los reales del negocio).
// Contacto público del negocio (footer + comprobantes de transferencia).
export const BUSINESS_WHATSAPP_DISPLAY = '+54 9 11 6987-8641';
export const BUSINESS_WHATSAPP_LINK = 'https://wa.me/5491169878641';

// ─── Zona de reparto ─────────────────────────────────────────────────────────
// Ciudades habilitadas para delivery. Por ahora solo San Vicente.
export const DELIVERY_ZONE_CITIES = ['San Vicente'];
export const DELIVERY_ZONE_LABEL = 'San Vicente';

/** ¿La ciudad ingresada cae dentro de la zona de reparto habilitada? */
export function isCityInDeliveryZone(city: string | null | undefined): boolean {
  const norm = (city ?? '').trim().toLowerCase();
  if (!norm) return false;
  return DELIVERY_ZONE_CITIES.some((c) => norm.includes(c.toLowerCase()));
}

export const TRANSFER_INFO = {
  alias: 'cambalache.sv',
  cbu: '', // Se transfiere por alias; si querés mostrar CBU, cargalo acá.
  holder: 'Paula Victoria Yaggi',
  // WhatsApp al que el cliente envía el comprobante de transferencia.
  whatsapp: BUSINESS_WHATSAPP_DISPLAY,
  whatsappLink: BUSINESS_WHATSAPP_LINK,
};
