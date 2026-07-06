import type {
  Order,
  OrderItem,
  Product,
  Promotion,
  User,
  Address,
  Payment,
  OrderStatus,
  DeliveryType,
  PaymentMethod,
} from '@prisma/client';

export type OrderWithRelations = Order & {
  user: Pick<User, 'id' | 'name' | 'email' | 'phone'>;
  address: Address | null;
  items: (OrderItem & {
    product: Product | null;
    promotion: Promotion | null;
  })[];
  payment: Payment | null;
};

export interface CreateOrderPayload {
  userId: string;
  addressId?: string;
  deliveryType: DeliveryType;
  paymentMethod: PaymentMethod;
  subtotal: number;
  deliveryFee: number;
  total: number;
  cashAmount?: number;
  transferAmount?: number;
  notes?: string;
  phone?: string;
  whatsappToken?: string;
  items: CreateOrderItemPayload[];
}

export interface CreateOrderItemPayload {
  productId?: string;
  promotionId?: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

export interface UpdateOrderStatusPayload {
  status: OrderStatus;
  estimatedTime?: number;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDIENTE_PAGO: 'Pendiente de pago',
  RECIBIDO: 'Recibido',
  CONFIRMADO: 'Confirmado',
  PREPARANDO: 'Preparando',
  EN_HORNO: 'En Horno',
  LISTO: 'Listo',
  EN_REPARTO: 'En Reparto',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
};

export const ORDER_STATUS_COLORS: Record<OrderStatus, string> = {
  PENDIENTE_PAGO: '#FF9800',
  RECIBIDO: '#2196F3',
  CONFIRMADO: '#9C27B0',
  PREPARANDO: '#FF9800',
  EN_HORNO: '#F44336',
  LISTO: '#4CAF50',
  EN_REPARTO: '#00BCD4',
  ENTREGADO: '#8BC34A',
  CANCELADO: '#9E9E9E',
};
