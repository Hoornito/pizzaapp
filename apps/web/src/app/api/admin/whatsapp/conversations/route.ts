import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { listConversations } from '@/services/whatsapp-inbox.service';

export async function GET() {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const data = await listConversations();
  return NextResponse.json({ success: true, data }, { headers: { 'Cache-Control': 'no-store' } });
}
