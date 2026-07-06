import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { employeeSchema } from '@/lib/validators';
import { updateEmployee, deleteEmployee } from '@/services/employee.service';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = employeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Datos inválidos' },
      { status: 400 }
    );
  }

  const employee = await updateEmployee(id, parsed.data);
  return NextResponse.json({ success: true, data: employee });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  try {
    await deleteEmployee(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: 'No se puede eliminar: el empleado tiene movimientos asociados. Desactivalo en su lugar.' },
      { status: 400 }
    );
  }
}
