import { EventEmitter } from 'events';
import type { OrderWithRelations } from '@/types/order.types';

type EventMap = {
  'order:created': [order: OrderWithRelations];
  'order:status_changed': [order: OrderWithRelations];
  'order:paid': [order: OrderWithRelations];
};

class TypedEventEmitter extends EventEmitter {
  emit<K extends keyof EventMap>(event: K, ...args: EventMap[K]): boolean {
    return super.emit(event, ...args);
  }

  on<K extends keyof EventMap>(event: K, listener: (...args: EventMap[K]) => void): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  off<K extends keyof EventMap>(event: K, listener: (...args: EventMap[K]) => void): this {
    return super.off(event, listener as (...args: unknown[]) => void);
  }
}

const globalForBus = globalThis as unknown as { eventBus: TypedEventEmitter | undefined };

export const eventBus = globalForBus.eventBus ?? new TypedEventEmitter();

// El global va SIEMPRE, también en producción (misma razón que socket-server.ts).
// Quien emite son las rutas de API, que corren dentro del bundle de Next; quien
// escucha es server.ts, que corre con tsx. Son dos grafos de módulos separados:
// sin este global cada uno se arma su propio EventEmitter y los eventos nunca
// cruzan. Con `if (NODE_ENV !== 'production')` andaba en dev y en producción no
// se disparaba ni un mail, ni un WhatsApp de cambio de estado, ni un push.
globalForBus.eventBus = eventBus;
