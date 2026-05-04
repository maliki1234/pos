import { Prisma } from '@prisma/client';

export function buildProductWhere(
  businessId: string,
  storeId: string,
  filters: { search?: string; categoryId?: string } = {}
): Prisma.ProductWhereInput {
  return {
    businessId,
    storeId,
    isActive: true,
    ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
    ...(filters.search ? {
      OR: [
        { name: { contains: filters.search, mode: 'insensitive' } },
        { barcode: { contains: filters.search, mode: 'insensitive' } },
      ],
    } : {}),
  };
}
