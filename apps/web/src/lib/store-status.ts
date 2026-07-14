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
