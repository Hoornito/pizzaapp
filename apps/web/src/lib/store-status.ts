/** Mensaje al cliente cuando la tienda no está tomando pedidos. */
export const STORE_CLOSED_MSG = 'Aún estamos cerrados 🕒 Volvé en un rato.';

/**
 * ¿La tienda está tomando pedidos ahora? Consulta el estado público.
 * Ante un error de red devolvemos `true` (no bloqueamos en el cliente; el
 * servidor igual valida al confirmar el pedido).
 */
export async function fetchStoreOpen(): Promise<boolean> {
  try {
    const res = await fetch('/api/store/status', { cache: 'no-store' });
    if (!res.ok) return true;
    const data = await res.json();
    return data.open !== false;
  } catch {
    return true;
  }
}

/**
 * Estado completo de la tienda. `test` indica que la caja abierta es de
 * SIMULACIÓN: para el público la web está cerrada, y el staff que sí puede
 * pedir (open === true) tiene que ver bien claro que es un pedido de prueba.
 */
export async function fetchStoreStatus(): Promise<{ open: boolean; test: boolean }> {
  try {
    const res = await fetch('/api/store/status', { cache: 'no-store' });
    if (!res.ok) return { open: true, test: false };
    const data = await res.json();
    return { open: data.open !== false, test: data.test === true };
  } catch {
    return { open: true, test: false };
  }
}
