import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getReportData } from '@/services/report.service';
import { formatCurrency, formatDate } from '@/lib/utils';
import * as XLSX from 'xlsx';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const format = (searchParams.get('format') || 'xlsx') as 'xlsx' | 'csv';
  const period = (searchParams.get('period') || 'week') as 'day' | 'week' | 'month';
  const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

  const report = await getReportData(period, date);

  if (format === 'xlsx') {
    const wb = XLSX.utils.book_new();

    const revenueRows = [
      ['Fecha', 'Ingresos'],
      ...(report.revenueByDay || []).map((d: any) => [d.date, d.revenue]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(revenueRows), 'Ingresos');

    const productRows = [
      ['Producto', 'Cantidad', 'Ingresos'],
      ...(report.topProducts || []).map((p: any) => [p.name, p.quantity, p.revenue]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(productRows), 'Productos');

    const promoRows = [
      ['Promoción', 'Cantidad', 'Ingresos'],
      ...(report.topPromotions || []).map((p: any) => [p.name, p.quantity, p.revenue]),
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(promoRows), 'Promociones');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="reporte-${period}-${date}.xlsx"`,
      },
    });
  }

  const csvRows = [
    'Fecha,Ingresos',
    ...(report.revenueByDay || []).map((d: any) => `${d.date},${d.revenue}`),
  ];
  return new NextResponse(csvRows.join('\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="reporte-${period}-${date}.csv"`,
    },
  });
}
