import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const schema = z.object({
  name: z.string().trim().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
  // Vacío = sin teléfono (null): el teléfono es único y dos "" chocarían.
  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || (v.length >= 6 && /^[\d\s+()-]+$/.test(v)), 'Ingresá un teléfono válido')
    .transform((v) => v || null)
    .optional(),
});

const profileSelect = { id: true, name: true, email: true, phone: true } as const;

// Los datos del perfil salen de la base, no de la sesión: la sesión se arma al
// loguearse y puede estar vieja (o todavía cargando cuando se pinta el form).
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: profileSelect });
  if (!user) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });

  return NextResponse.json({ success: true, data: user });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
  }

  try {
    const user = await prisma.user.update({
      where: { id: session.user.id },
      data: parsed.data,
      select: profileSelect,
    });
    return NextResponse.json({ success: true, data: user });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
      return NextResponse.json({ error: 'Ese teléfono ya está registrado en otra cuenta' }, { status: 409 });
    }
    throw e;
  }
}
