import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getCategories, createCategory } from '@/services/product.service';
import { categorySchema } from '@/lib/validators';

export async function GET() {
  const categories = await getCategories();
  return NextResponse.json({ success: true, data: categories });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const body = await req.json();
  const parsed = categorySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Datos inválidos', details: parsed.error.flatten() }, { status: 400 });
  }

  const category = await createCategory(parsed.data);
  return NextResponse.json({ success: true, data: category }, { status: 201 });
}
