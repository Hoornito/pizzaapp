import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getReportData, getDashboardStats } from '@/services/report.service';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') as 'dashboard' | 'daily' | 'weekly' | 'monthly' | 'annual' | null;
  const dateStr = searchParams.get('date');
  const date = dateStr ? new Date(dateStr) : undefined;

  if (type === 'dashboard') {
    const stats = await getDashboardStats();
    return NextResponse.json({ success: true, data: stats });
  }

  const period = type || 'daily';
  const report = await getReportData(period as 'daily' | 'weekly' | 'monthly' | 'annual', date);
  return NextResponse.json({ success: true, data: report });
}
