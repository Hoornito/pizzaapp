import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/roles';
import { employeeAccountSchema } from '@/lib/validators';
import {
  createEmployeeAccount,
  linkEmployeeAccount,
  resetEmployeeAccountPassword,
  unlinkEmployeeAccount,
} from '@/services/employee-account.service';

/** Crear cuenta, vincular una existente o ponerle nueva contraseña. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id } = await params;
  const parsed = employeeAccountSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Datos inválidos' }, { status: 400 });
  }

  try {
    const input = parsed.data;
    if (input.action === 'create') {
      const user = await createEmployeeAccount(id, input.email, input.password);
      return NextResponse.json({ success: true, data: user }, { status: 201 });
    }
    if (input.action === 'link') {
      const user = await linkEmployeeAccount(id, input.email);
      return NextResponse.json({ success: true, data: user });
    }
    await resetEmployeeAccountPassword(id, input.password);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Error' }, { status: 400 });
  }
}

/** Desvincular la cuenta (la cuenta sigue existiendo, solo deja de ver el legajo). */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;
  await unlinkEmployeeAccount(id);
  return NextResponse.json({ success: true });
}
