import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { shipmentZoneSchema } from '@/lib/validators';

export async function GET() {
  const zones = await prisma.shipmentZone.findMany({
    include: { deliveryFees: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json({ success: true, data: zones });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = shipmentZoneSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const zone = await prisma.shipmentZone.create({ data: parsed.data });
  return NextResponse.json({ success: true, data: zone }, { status: 201 });
}
