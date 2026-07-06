import { prisma } from '@/lib/prisma';
import type { PromotionInput } from '@/lib/validators';
import type { Prisma } from '@prisma/client';

export async function getPromotions(params?: { available?: boolean }) {
  const where: Prisma.PromotionWhereInput = {};
  if (params?.available !== undefined) where.available = params.available;

  const now = new Date();
  if (params?.available) {
    where.OR = [
      { startDate: null },
      { AND: [{ startDate: { lte: now } }, { OR: [{ endDate: null }, { endDate: { gte: now } }] }] },
    ];
  }

  return prisma.promotion.findMany({
    where,
    include: {
      items: {
        include: { product: { include: { category: true } } },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getPromotionById(id: string) {
  return prisma.promotion.findUnique({
    where: { id },
    include: {
      items: {
        include: { product: { include: { category: true } } },
      },
    },
  });
}

export async function createPromotion(data: PromotionInput) {
  const { items, ...rest } = data;
  return prisma.promotion.create({
    data: {
      ...rest,
      items: {
        create: items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
      },
    },
    include: {
      items: { include: { product: true } },
    },
  });
}

export async function updatePromotion(id: string, data: Partial<PromotionInput>) {
  const { items, ...rest } = data;

  return prisma.$transaction(async (tx) => {
    if (items) {
      await tx.promotionItem.deleteMany({ where: { promotionId: id } });
      await tx.promotionItem.createMany({
        data: items.map((item) => ({
          promotionId: id,
          productId: item.productId,
          quantity: item.quantity,
        })),
      });
    }

    return tx.promotion.update({
      where: { id },
      data: rest,
      include: { items: { include: { product: true } } },
    });
  });
}

export async function deletePromotion(id: string) {
  return prisma.promotion.delete({ where: { id } });
}
