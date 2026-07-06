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
  const format = searchParams.get('format') as 'xlsx' | 'csv' || 'xlsx';
  const period = (searchParams.get('period') || 'monthly') as 'daily' | 'weekly' | 'monthly' | 'annual';
  const dateStr = searchParams.get('date');
  const date = dateStr ? new Date(dateStr) : undefined;

  const report = await getReportData(period, date);

  if (format === 'xlsx') {
    const wb = XLSX.utils.book_new();

    const summaryData = [
      ['Reporte de Ventas', ''],
      ['Período', period],
      ['Fecha generación', formatDate(new Date())],
      [''],
      ['RESUMEN', ''],
      ['Total facturado', formatCurrency(report.totalRevenue)],
      ['Total pedidos', report.totalOrders],
      ['Pedidos entregados', report.deliveredOrders],
      ['Pedidos cancelados', report.cancelledOrders],
      ['Ticket promedio', formatCurrency(report.averageTicket)],
    ];
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summarySheet, 'Resumen');

    const revenueRows = [['Fecha', 'Ingresos', 'Pedidos'], ...report.revenueByDay.map((d) => [d.date, d.revenue, d.orders])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(revenueRows), 'Ventas por día');

    const productRows = [['Producto', 'Cantidad', 'Ingresos'], ...report.topProducts.map((p) => [p.name, p.quantity, p.revenue])];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(productRows), 'Top Productos');

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="reporte-${period}-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  }

  // CSV fallback
  const csvRows = [
    'Fecha,Ingresos,Pedidos',
    ...report.revenueByDay.map((d) => `${d.date},${d.revenue},${d.orders}`),
  ];
  const csv = csvRows.join('\n');

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="reporte-${period}.csv"`,
    },
  });
}
