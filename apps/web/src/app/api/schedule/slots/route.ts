import { NextResponse } from 'next/server';
import { getTodaySlots, MIN_LEAD_MINUTES, SLOT_MINUTES } from '@/services/schedule.service';

// Franjas horarias disponibles para programar un pedido (solo hoy).
// Se calculan en el servidor para que no dependan del reloj del cliente.
export async function GET() {
  const slots = await getTodaySlots();
  return NextResponse.json(
    { success: true, data: slots, minLeadMinutes: MIN_LEAD_MINUTES, slotMinutes: SLOT_MINUTES },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
