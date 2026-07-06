import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { sendText } from '@/lib/whatsapp';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { to, message } = await req.json();
  if (!to || !message) {
    return NextResponse.json({ error: 'to y message son requeridos' }, { status: 400 });
  }

  await sendText(to, message);
  return NextResponse.json({ success: true });
}
