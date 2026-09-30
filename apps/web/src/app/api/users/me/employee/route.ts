import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getMyEmployeeRecord } from '@/services/employee-account.service';

/** Legajo del empleado vinculado a la cuenta logueada (data: null si no es empleado). */
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const record = await getMyEmployeeRecord(session.user.id);
  return NextResponse.json({ success: true, data: record });
}
