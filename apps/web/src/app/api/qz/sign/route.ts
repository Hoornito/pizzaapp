import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { auth } from '@/lib/auth';
import { isStaff } from '@/lib/roles';

/**
 * Firma con la clave privada cada pedido que QZ Tray va a imprimir, así QZ
 * confía en el sitio y NO pide autorización en cada impresión.
 *
 * - La clave privada vive solo en el servidor (env QZ_PRIVATE_KEY_B64), nunca
 *   llega al navegador.
 * - Requiere sesión de personal (ADMIN/MOSTRADOR): la estación de impresión
 *   está logueada, y así no queda un "oráculo de firma" abierto a cualquiera.
 * - Algoritmo: RSA con SHA-512 (el que espera QZ Tray 2.1+), firma en base64.
 */
function getPrivateKey(): string | null {
  const b64 = process.env.QZ_PRIVATE_KEY_B64;
  if (!b64) return null;
  return Buffer.from(b64, 'base64').toString('utf8');
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || !isStaff(session.user.role)) {
    return new NextResponse('No autorizado', { status: 401 });
  }

  const key = getPrivateKey();
  // Sin firma configurada: devolvemos vacío y QZ cae al modo sin firma (prompt).
  if (!key) return new NextResponse('', { status: 200 });

  const toSign = req.nextUrl.searchParams.get('request') ?? '';
  try {
    const signer = crypto.createSign('SHA512');
    signer.update(toSign);
    signer.end();
    const signature = signer.sign(key, 'base64');
    return new NextResponse(signature, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch {
    return new NextResponse('', { status: 500 });
  }
}
