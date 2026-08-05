import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { isAIGloballyDisabled, setAIGloballyDisabled } from '@/services/wa-order-flow.service';
import { availableProviders, defaultProvider, modelFor } from '@/lib/ai-provider';

// Estado del kill-switch global + qué proveedores de IA hay configurados.
export async function GET() {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const providers = availableProviders();
  return NextResponse.json({
    success: true,
    disabled: await isAIGloballyDisabled(),
    providers: providers.map((p) => ({ id: p, model: modelFor(p, 'parser') })),
    defaultProvider: defaultProvider(),
  });
}

const bodySchema = z.object({ disabled: z.boolean() });

// Prende/apaga la IA en TODOS los chats.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  await setAIGloballyDisabled(parsed.data.disabled);
  return NextResponse.json({ success: true, disabled: parsed.data.disabled });
}
