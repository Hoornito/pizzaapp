import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { getConversationMessages, markConversationRead } from '@/services/whatsapp-inbox.service';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;
  const data = await getConversationMessages(id);
  // Abrir la conversación la marca como leída.
  await markConversationRead(id).catch(() => {});
  return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
}
