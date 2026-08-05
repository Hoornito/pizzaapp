import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import {
  getActiveVersion,
  listVersions,
  restoreVersion,
  saveInstructions,
} from '@/services/wa-instructions.service';
import { countPending } from '@/services/wa-corrections.service';

// Instrucciones activas + historial de versiones.
export async function GET() {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const [active, versions, pending] = await Promise.all([
    getActiveVersion(),
    listVersions(),
    countPending(),
  ]);
  return NextResponse.json(
    { success: true, active, versions, pendingCorrections: pending },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

const bodySchema = z.object({
  content: z.string().min(1).optional(),
  note: z.string().nullish(),
  // Restaurar una versión anterior (crea una nueva con ese contenido).
  restoreVersion: z.coerce.number().int().positive().optional(),
});

// Guardar edición manual, o restaurar una versión vieja.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  const { content, note, restoreVersion: version } = parsed.data;
  try {
    const saved = version
      ? await restoreVersion(version, session.user.id)
      : content
        ? await saveInstructions(content, { source: 'manual', note, userId: session.user.id })
        : null;
    if (!saved) return NextResponse.json({ error: 'Nada para guardar' }, { status: 400 });

    const versions = await listVersions();
    return NextResponse.json({ success: true, active: saved, versions });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'No se pudo guardar' },
      { status: 400 }
    );
  }
}
