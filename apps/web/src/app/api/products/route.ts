import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getProducts, createProduct } from '@/services/product.service';
import { productSchema } from '@/lib/validators';
import { rateLimit } from '@/lib/rate-limiter';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get('categoryId') || undefined;
  const available = searchParams.get('available');
  const search = searchParams.get('search') || undefined;
  const page = parseInt(searchParams.get('page') || '1');
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

  const result = await getProducts({
    categoryId,
    available: available !== null ? available === 'true' : undefined,
    search,
    page,
    limit,
  });

  return NextResponse.json({ success: true, ...result });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const rl = await rateLimit(req, { windowMs: 60_000, max: 30, keyPrefix: 'rl:products' });
  if (!rl.success) {
    return NextResponse.json({ error: 'Demasiadas solicitudes' }, { status: 429 });
  }

  const body = await req.json();
  const parsed = productSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });
  }

  const product = await createProduct(parsed.data);
  return NextResponse.json({ success: true, data: product }, { status: 201 });
}
