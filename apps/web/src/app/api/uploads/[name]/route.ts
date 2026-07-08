import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { UPLOAD_DIR } from '@/lib/storage';

/** Sirve una imagen subida desde el directorio de uploads (volumen persistente). */
const TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
};

export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const safe = path.basename(name); // evita path traversal
  const type = TYPES[path.extname(safe).toLowerCase()];
  if (!type) return new NextResponse('No encontrado', { status: 404 });
  try {
    const buf = await readFile(path.join(UPLOAD_DIR, safe));
    return new NextResponse(buf, {
      headers: { 'Content-Type': type, 'Cache-Control': 'public, max-age=31536000, immutable' },
    });
  } catch {
    return new NextResponse('No encontrado', { status: 404 });
  }
}
