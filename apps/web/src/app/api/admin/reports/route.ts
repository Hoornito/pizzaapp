import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getReportData } from '@/services/report.service';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const period = (searchParams.get('period') || 'week') as 'day' | 'week' | 'month';
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

  const data = await getReportData(period, date);
  return NextResponse.json({ success: true, data });
}
