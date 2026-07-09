import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { getPostresData } from '@/services/postres.service';

export async function GET() {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const data = await getPostresData();
  return NextResponse.json({ success: true, data });
}
