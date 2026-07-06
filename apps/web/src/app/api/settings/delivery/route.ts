import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { deliveryFeeSchema } from '@/lib/validators';

export async function GET() {
  const fees = await prisma.deliveryFee.findMany({
    include: { zone: true },
    orderBy: { name: 'asc' },
  });
  return NextResponse.json({ success: true, data: fees });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = deliveryFeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }

  const fee = await prisma.deliveryFee.create({ data: parsed.data, include: { zone: true } });
  return NextResponse.json({ success: true, data: fee }, { status: 201 });
}
