import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';
import { applyDistilled, distillCorrections } from '@/services/wa-corrections.service';
import { getInstructions, listVersions } from '@/services/wa-instructions.service';

// Pide una propuesta de instrucciones nuevas a partir de las correcciones
// pendientes. NO guarda nada: devuelve el texto actual y el propuesto para que
// una persona compare y decida.
export async function POST() {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  try {
    const [current, result] = await Promise.all([getInstructions(true), distillCorrections()]);
    return NextResponse.json({ success: true, current, proposed: result.content, basedOn: result.basedOn });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'No se pudo destilar' },
      { status: 400 }
    );
  }
}

const applySchema = z.object({ content: z.string().min(1) });

// Aplica la propuesta (tal cual o editada a mano): nueva versión + marca las
// correcciones pendientes como aplicadas.
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }
  const parsed = applySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
  }
  try {
    const { version, applied } = await applyDistilled(parsed.data.content, session.user.id);
    const versions = await listVersions();
    return NextResponse.json({ success: true, active: version, versions, applied });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'No se pudo aplicar' },
      { status: 400 }
    );
  }
}
