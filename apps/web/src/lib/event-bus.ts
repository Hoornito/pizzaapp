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

if (process.env.NODE_ENV !== 'production') globalForBus.eventBus = eventBus;
