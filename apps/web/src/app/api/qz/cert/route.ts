import { NextResponse } from 'next/server';

/**
 * Devuelve el certificado público que QZ Tray usa para confiar en el sitio.
 * Es público (el certificado no es secreto). Si no está configurado
 * (QZ_CERTIFICATE_B64 vacío), devuelve vacío y QZ Tray cae al modo sin firma
 * (vuelve a pedir "Allow"), sin romper nada.
 */
export async function GET() {
  const b64 = process.env.QZ_CERTIFICATE_B64;
  if (!b64) return new NextResponse('', { status: 200 });
  const cert = Buffer.from(b64, 'base64').toString('utf8');
  return new NextResponse(cert, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
