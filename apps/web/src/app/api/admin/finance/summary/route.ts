import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getFinanceSummary } from '@/services/finance.service';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date') || undefined;

  const data = await getFinanceSummary(date);
  return NextResponse.json({ success: true, data });
}
