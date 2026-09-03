import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { z } from 'zod';
import { getConversationView, markConversationRead, renameContact } from '@/services/whatsapp-inbox.service';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;
  const view = await getConversationView(id);
  // Abrir la conversación la marca como leída.
  await markConversationRead(id).catch(() => {});
  return NextResponse.json(
    { success: true, data: view.messages, flow: view.flow, readyOrder: view.readyOrder, addonOf: view.addonOf, humanReason: view.humanReason, botPaused: view.botPaused },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

const patchSchema = z.object({ contactName: z.string().max(80) });

// Renombrar el contacto (el nombre que después se muestra en Pedidos).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Nombre inválido' }, { status: 400 });
  }
  const convo = await renameContact(id, parsed.data.contactName);
  return NextResponse.json({ success: true, data: { contactName: convo.contactName } });
}
