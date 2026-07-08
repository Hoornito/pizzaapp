import { prisma } from '@/lib/prisma';
import { storage } from '@/lib/storage';
import type { ProductInput, CategoryInput } from '@/lib/validators';
import type { Prisma } from '@prisma/client';

export async function getProducts(params?: {
  categoryId?: string;
  available?: boolean;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const { categoryId, available, search, page = 1, limit = 50 } = params || {};

  const where: Prisma.ProductWhereInput = {};
  if (categoryId) where.categoryId = categoryId;
  if (available !== undefined) where.available = available;
  if (search) where.name = { contains: search, mode: 'insensitive' };

  const [data, total] = await Promise.all([
    prisma.product.findMany({
      where,
      include: { category: true },
      orderBy: { name: 'asc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.product.count({ where }),
  ]);

  return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getProductById(id: string) {
  return prisma.product.findUnique({
    where: { id },
    include: { category: true },
  });
}

export async function createProduct(data: ProductInput) {
  return prisma.product.create({
    data: {
      name: data.name,
      description: data.description,
      price: data.price,
      categoryId: data.categoryId,
      stock: data.stock ?? 0,
      available: data.available ?? true,
      image: data.image,
      priceSmall: data.priceSmall ?? null,
      priceMedium: data.priceMedium ?? null,
      priceLarge: data.priceLarge ?? null,
    },
    include: { category: true },
  });
}

export async function updateProduct(id: string, data: Partial<ProductInput>) {
  return prisma.product.update({
    where: { id },
    data,
    include: { category: true },
  });
}

export async function deleteProduct(id: string) {
  const product = await prisma.product.findUnique({ where: { id } });
  // PromotionItem.productId es obligatorio (bloquea el borrado): sacamos el
  // producto de las promos primero. Los ítems de pedidos/carrito tienen
  // productId opcional, así que quedan con SetNull y el historial se conserva.
  await prisma.promotionItem.deleteMany({ where: { productId: id } });
  if (product?.image?.startsWith('/api/uploads/') || product?.image?.startsWith('/uploads/')) {
    await storage.delete(product.image).catch(() => {});
  }
  return prisma.product.delete({ where: { id } });
}

export async function getCategories() {
  return prisma.category.findMany({
    orderBy: { sortOrder: 'asc' },
    include: { _count: { select: { products: true } } },
  });
}

export async function getCategoryById(id: string) {
  return prisma.category.findUnique({ where: { id } });
}

export async function createCategory(data: CategoryInput) {
  return prisma.category.create({ data });
}

export async function updateCategory(id: string, data: Partial<CategoryInput>) {
  return prisma.category.update({ where: { id }, data });
}

export async function deleteCategory(id: string) {
  return prisma.category.delete({ where: { id } });
}
