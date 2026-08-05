import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { simulateCustomerMessage } from '@/services/wa-sim.service';

const bodySchema = z.object({
  phone: z.string().min(3).max(20),
  text: z.string().min(1).max(4096),
  // Con qué IA responder este chat (para comparar Claude vs Gemini).
  provider: z.enum(['anthropic', 'gemini']).optional(),
});

// Simulador local: manda un mensaje como si fuera un cliente por WhatsApp.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  try {
    const view = await simulateCustomerMessage(
      parsed.data.phone.trim(),
      parsed.data.text.trim(),
      parsed.data.provider
    );
    return NextResponse.json(
      { success: true, id: view.id, data: view.messages, flow: view.flow, readyOrder: view.readyOrder, addonOf: view.addonOf, humanReason: view.humanReason, botPaused: view.botPaused },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error en el simulador' },
      { status: 400 }
    );
  }
}
