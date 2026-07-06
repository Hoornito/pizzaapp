import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getNotifications, markAllNotificationsRead } from '@/services/notification.service';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const unreadOnly = searchParams.get('unreadOnly') === 'true';
  const limit = parseInt(searchParams.get('limit') || '50');

  const userId = session.user.role === 'ADMIN' ? undefined : session.user.id;
  const notifications = await getNotifications({ userId, unreadOnly, limit });

  return NextResponse.json({ success: true, data: notifications });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const { action } = await req.json();
  if (action === 'markAllRead') {
    const userId = session.user.role === 'ADMIN' ? undefined : session.user.id;
    await markAllNotificationsRead(userId);
  }

  return NextResponse.json({ success: true });
}
