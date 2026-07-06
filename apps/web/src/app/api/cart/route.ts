import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const cart = await prisma.cart.findUnique({
    where: { userId: session.user.id },
    include: {
      items: {
        include: {
          product: { select: { name: true, image: true } },
          promotion: { select: { name: true, image: true } },
        },
      },
    },
  });

  return NextResponse.json({ success: true, data: cart?.items || [] });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 });

  const body = await req.json();
  const { items } = body;

  // Ensure cart exists
  let cart = await prisma.cart.findUnique({
    where: { userId: session.user.id },
  });

  if (!cart) {
    cart = await prisma.cart.create({
      data: { userId: session.user.id },
    });
  }

  // Delete old items and create new ones
  await prisma.cartItem.deleteMany({
    where: { cartId: cart.id },
  });

  if (items && items.length > 0) {
    await prisma.cartItem.createMany({
      data: items.map((item: any) => ({
        cartId: cart.id,
        productId: item.productId,
        promotionId: item.promotionId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        notes: item.notes,
      })),
    });
  }

  return NextResponse.json({ success: true });
}
