import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { getPostresData } from '@/services/postres.service';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const periodParam = searchParams.get('period');
  const period = periodParam === 'day' || periodParam === 'week' || periodParam === 'month' ? periodParam : undefined;
  const date = searchParams.get('date') || undefined;
  const shiftParam = searchParams.get('shift');
  const shift =
    shiftParam === 'MANANA' || shiftParam === 'NOCHE' || shiftParam === 'BOTH' ? shiftParam : undefined;

  const data = await getPostresData({ period, date, shift });
  return NextResponse.json(
    { success: true, data },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
