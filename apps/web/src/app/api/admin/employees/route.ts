import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { employeeSchema } from '@/lib/validators';
import { listEmployees, createEmployee, listDeliveryEmployees } from '@/services/employee.service';

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const role = searchParams.get('role');

  // Lista liviana de repartidores para asignar en pedidos: disponible para
  // todo el staff (incluye Mostrador), que gestiona el panel de pedidos.
  if (role === 'REPARTIDOR') {
    const repartidores = await listDeliveryEmployees();
    return NextResponse.json({ success: true, data: repartidores });
  }

  // La lista completa de empleados es información sensible: solo ADMIN.
  if (session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const onlyActive = searchParams.get('active') === 'true';
  const employees = await listEmployees(!onlyActive);
  return NextResponse.json({ success: true, data: employees });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = employeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || 'Datos inválidos' },
      { status: 400 }
    );
  }

  const employee = await createEmployee(parsed.data);
  return NextResponse.json({ success: true, data: employee }, { status: 201 });
}
