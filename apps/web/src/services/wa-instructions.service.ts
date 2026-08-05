import fs from 'node:fs';
import path from 'node:path';
import { prisma } from '@/lib/prisma';

/**
 * Instrucciones del bot de WhatsApp, versionadas en la base.
 *
 * Antes vivían solo en `src/prompts/wa-bot-instructions.md`. Ese archivo sigue
 * siendo el punto de partida (seed), pero la fuente de verdad es la DB: en
 * producción el .md está dentro de la imagen Docker, así que cualquier edición
 * hecha desde el panel se perdería en el próximo build.
 *
 * Cada guardado crea una versión nueva; la más alta es la activa. No se pisa ni
 * se borra nada: restaurar es crear una versión nueva con el contenido viejo.
 */

const SEED_PATH = path.join(process.cwd(), 'src/prompts/wa-bot-instructions.md');

export type InstructionSource = 'seed' | 'manual' | 'destilado';

export interface InstructionVersion {
  id: string;
  version: number;
  content: string;
  source: string;
  note: string | null;
  createdAt: Date;
}

// El parser las pide en CADA mensaje: un TTL corto evita ir a la base todo el
// tiempo sin que las ediciones tarden en verse.
const TTL_MS = 20 * 1000;
let cache: { at: number; content: string } | null = null;

function readSeedFile(): string {
  try {
    return fs.readFileSync(SEED_PATH, 'utf8').trim();
  } catch {
    return '';
  }
}

/** Texto activo de las instrucciones (lo que se le manda al modelo). */
export async function getInstructions(force = false): Promise<string> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.content;
  const active = await getActiveVersion();
  const content = active?.content ?? '';
  cache = { at: Date.now(), content };
  return content;
}

/**
 * Versión activa. Si la tabla está vacía, siembra la v1 con el contenido del
 * .md para que el panel arranque mostrando lo que el bot ya venía usando.
 */
export async function getActiveVersion(): Promise<InstructionVersion | null> {
  const latest = await prisma.botInstruction.findFirst({ orderBy: { version: 'desc' } });
  if (latest) return latest;

  const seed = readSeedFile();
  if (!seed) return null;
  try {
    return await prisma.botInstruction.create({
      data: { version: 1, content: seed, source: 'seed', note: 'Importado de wa-bot-instructions.md' },
    });
  } catch {
    // Otra request sembró primero (choque de version única): usamos la suya.
    return prisma.botInstruction.findFirst({ orderBy: { version: 'desc' } });
  }
}

/** Guarda una versión nueva y la deja activa. Devuelve la versión creada. */
export async function saveInstructions(
  content: string,
  opts: { source: InstructionSource; note?: string | null; userId?: string | null }
): Promise<InstructionVersion> {
  const text = content.trim();
  if (!text) throw new Error('Las instrucciones no pueden quedar vacías.');

  // Reintentamos por si dos guardados toman el mismo número de versión.
  for (let i = 0; i < 5; i++) {
    const latest = await prisma.botInstruction.findFirst({ orderBy: { version: 'desc' } });
    if (latest?.content.trim() === text) return latest; // sin cambios: no versionamos
    try {
      const created = await prisma.botInstruction.create({
        data: {
          version: (latest?.version ?? 0) + 1,
          content: text,
          source: opts.source,
          note: opts.note?.trim() || null,
          createdById: opts.userId ?? null,
        },
      });
      cache = { at: Date.now(), content: created.content };
      return created;
    } catch (e) {
      if ((e as { code?: string })?.code === 'P2002') continue;
      throw e;
    }
  }
  throw new Error('No se pudo guardar (choque de versiones). Probá de nuevo.');
}

/** Historial, de la más nueva a la más vieja. */
export async function listVersions(limit = 30): Promise<InstructionVersion[]> {
  return prisma.botInstruction.findMany({ orderBy: { version: 'desc' }, take: limit });
}

/** Restaurar = crear una versión nueva con el contenido de una vieja. */
export async function restoreVersion(version: number, userId?: string | null): Promise<InstructionVersion> {
  const old = await prisma.botInstruction.findUnique({ where: { version } });
  if (!old) throw new Error('Esa versión no existe.');
  return saveInstructions(old.content, {
    source: 'manual',
    note: `Restaurada la v${version}`,
    userId,
  });
}
