import type { Product, Category, Promotion, PromotionItem } from '@prisma/client';

export type ProductWithCategory = Product & {
  category: Category;
};

export type PromotionWithItems = Promotion & {
  items: (PromotionItem & {
    product: Product;
  })[];
};

/** Un sabor elegido dentro de una docena de empanadas. */
export interface EmpanadaDozenFlavor {
  productId: string;
  name: string;
  quantity: number;
}

/** Composición de una docena: la suma de `quantity` de sus sabores debe ser 12. */
export interface EmpanadaDozen {
  flavors: EmpanadaDozenFlavor[];
}

export const DOZEN_SIZE = 12;

// ─── Pizzas por tamaño ────────────────────────────────────────────────────────

export type PizzaSize = 'SMALL' | 'MEDIUM' | 'LARGE';

export const PIZZA_SIZES: PizzaSize[] = ['SMALL', 'MEDIUM', 'LARGE'];

export const PIZZA_SIZE_LABELS: Record<PizzaSize, string> = {
  SMALL: 'Pizza Chica',
  MEDIUM: 'Pizza Mediana',
  LARGE: 'Pizza Grande',
};

/** Campo de precio del Product según el tamaño. */
export const PIZZA_SIZE_PRICE_FIELD: Record<PizzaSize, 'priceSmall' | 'priceMedium' | 'priceLarge'> = {
  SMALL: 'priceSmall',
  MEDIUM: 'priceMedium',
  LARGE: 'priceLarge',
};

export interface PizzaFlavorRef {
  productId: string;
  name: string;
}

/** Una pizza armada: tamaño, 1 gusto (entera) o 2 (mitad y mitad), y su precio. */
export interface PizzaSelection {
  size: PizzaSize;
  flavors: PizzaFlavorRef[];
  price: number;
}

export interface CartItemLocal {
  id: string;
  type: 'product' | 'promotion';
  productId?: string;
  promotionId?: string;
  name: string;
  image?: string | null;
  unitPrice: number;
  quantity: number;
  notes?: string;
  /**
   * Presente sólo en el flujo de "Docena de Empanadas". Cada elemento es una
   * docena completa (12 empanadas) con su propia composición de sabores. El
   * `quantity` del ítem equivale a la cantidad de docenas (= `dozens.length`).
   */
  dozens?: EmpanadaDozen[];
  /** Presente sólo en el flujo de pizzas por tamaño (cada línea = 1 pizza). */
  pizza?: PizzaSelection;
}

export interface CartState {
  items: CartItemLocal[];
  subtotal: number;
  deliveryFee: number;
  total: number;
}
