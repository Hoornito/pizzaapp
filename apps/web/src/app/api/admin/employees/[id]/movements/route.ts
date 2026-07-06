import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { employeeMovementSchema } from '@/lib/validators';
import { addEmployeeMovement, getEmployeeMovements } from '@/services/employee.service';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;
  const movements = await getEmployeeMovements(id);
  return NextResponse.json({ success: true, data: movements });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = employeeMovementSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Datos inválidos' },
      { status: 400 }
    );
  }

  try {
    const movement = await addEmployeeMovement(id, parsed.data, session.user.id);
    return NextResponse.json({ success: true, data: movement }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al registrar el movimiento' },
      { status: 400 }
    );
  }
}
