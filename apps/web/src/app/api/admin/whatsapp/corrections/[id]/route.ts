import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { deleteCorrection } from '@/services/wa-corrections.service';

// Descartar una corrección.
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const { id } = await params;
  try {
    await deleteCorrection(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'No se pudo borrar' }, { status: 400 });
  }
}
