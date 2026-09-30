import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { isAdmin } from '@/lib/roles';
import { deleteSeniorityPayout } from '@/services/employee.service';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; payoutId: string }> }
) {
  const session = await auth();
  if (!session || !isAdmin(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const { id, payoutId } = await params;
  try {
    await deleteSeniorityPayout(id, payoutId);
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Error al eliminar' },
      { status: 404 }
    );
  }
}
