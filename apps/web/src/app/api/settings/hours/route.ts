import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { businessHoursSchema } from '@/lib/validators';
import { z } from 'zod';

export async function GET() {
  const hours = await prisma.businessHours.findMany({ orderBy: { dayOfWeek: 'asc' } });
  return NextResponse.json({ success: true, data: hours });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = z.array(businessHoursSchema).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });
  }

  const updated = await Promise.all(
    parsed.data.map((h) =>
      prisma.businessHours.upsert({
        where: { dayOfWeek: h.dayOfWeek },
        update: { openTime: h.openTime, closeTime: h.closeTime, isOpen: h.isOpen },
        create: h,
      })
    )
  );

  return NextResponse.json({ success: true, data: updated });
}
