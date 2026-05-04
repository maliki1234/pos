import { Prisma, StockBatch } from '@prisma/client';
import { NotFoundError, ValidationError, InsufficientStockError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { prisma } from '../utils/prisma.js';
import { getStockProfitValidation } from './stockProfitValidation.js';

type TxClient = Prisma.TransactionClient;
type DbClient = typeof prisma | TxClient;

export function buildStockBatchWhere(businessId: string, productId?: number, storeId?: string): Prisma.StockBatchWhereInput {
  return {
    isActive: true,
    ...(productId !== undefined ? { productId } : {}),
    product: { businessId },
    ...(storeId ? { storeId } : {}),
  };
}

export class StockService {
  async resolveStoreId(businessId: string, storeId?: string | null, tx?: TxClient): Promise<string> {
    const db: DbClient = tx ?? prisma;
    if (storeId) {
      const store = await db.store.findFirst({ where: { id: storeId, businessId, isActive: true } });
      if (!store) throw new NotFoundError('Store');
      return store.id;
    }

    const defaultStore = await db.store.findFirst({
      where: { businessId, isActive: true },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
    if (!defaultStore) throw new ValidationError('Create a store before managing stock');
    return defaultStore.id;
  }

  async getAllStockBatches(businessId: string, storeId?: string) {
    const resolvedStoreId = await this.resolveStoreId(businessId, storeId);
    return prisma.stockBatch.findMany({
      where: buildStockBatchWhere(businessId, undefined, resolvedStoreId),
      include: { product: true, store: true },
      orderBy: [{ productId: 'asc' }, { receivedDate: 'asc' }],
    });
  }

  async getStockBatches(businessId: string, productId: number, storeId?: string) {
    const resolvedStoreId = await this.resolveStoreId(businessId, storeId);
    const batches = await prisma.stockBatch.findMany({
      where: buildStockBatchWhere(businessId, productId, resolvedStoreId),
      include: { product: true, store: true },
      orderBy: { receivedDate: 'asc' },
    });
    return batches;
  }

  async addStockBatch(
    businessId: string,
    productId: number,
    storeId: string | undefined,
    quantity: number,
    unitCost: number,
    expiryDate?: Date,
    notes?: string
  ) {
    const resolvedStoreId = await this.resolveStoreId(businessId, storeId);
    const product = await prisma.product.findFirst({
      where: { id: productId, businessId, storeId: resolvedStoreId },
      include: { prices: { where: { isActive: true } } },
    });
    if (!product) throw new NotFoundError('Product');

    const profitValidation = getStockProfitValidation({ unitCost, prices: product.prices });
    if (profitValidation.hasLoss) {
      throw new ValidationError(profitValidation.lossMessages.join(' '));
    }

    const batch = await prisma.stockBatch.create({
      data: { productId, storeId: resolvedStoreId, quantity, quantityUsed: 0, unitCost, expiryDate, notes, isActive: true },
      include: { product: true, store: true },
    });

    logger.info(`Stock batch added: Product ${productId}, Batch #${batch.batchNumber}, Qty ${quantity}`);
    return batch;
  }

  async getTotalQuantity(productId: number, storeId: string, tx?: TxClient): Promise<number> {
    const db = tx ?? prisma;
    const batches = await db.stockBatch.findMany({ where: { productId, storeId, isActive: true } });
    return batches.reduce((sum, batch) => sum + (batch.quantity - batch.quantityUsed), 0);
  }

  async deductStockFIFO(productId: number, storeId: string, quantity: number, tx?: TxClient): Promise<StockBatch[]> {
    const db = tx ?? prisma;
    let remainingQty = quantity;
    const usedBatches: StockBatch[] = [];

    const batches = await db.stockBatch.findMany({
      where: { productId, storeId, isActive: true },
      orderBy: { receivedDate: 'asc' },
    });

    for (const batch of batches) {
      if (remainingQty <= 0) break;
      const availableQty = batch.quantity - batch.quantityUsed;
      if (availableQty <= 0) continue;
      const qtyToUse = Math.min(remainingQty, availableQty);

      const updatedBatch = await db.stockBatch.update({
        where: { id: batch.id },
        data: { quantityUsed: batch.quantityUsed + qtyToUse },
      });

      usedBatches.push(updatedBatch);
      remainingQty -= qtyToUse;
    }

    if (remainingQty > 0) {
      const totalAvailable = await this.getTotalQuantity(productId, storeId, tx);
      throw new InsufficientStockError(`Product ${productId}`, totalAvailable, quantity);
    }

    logger.info(`Stock deducted (FIFO): Product ${productId}, Qty ${quantity}, Batches used: ${usedBatches.length}`);
    return usedBatches;
  }

  async returnStock(productId: number, storeId: string, quantity: number, tx?: TxClient, notes?: string): Promise<StockBatch> {
    const db = tx ?? prisma;
    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundError('Product');

    const batch = await db.stockBatch.create({
      data: { productId, storeId, quantity, quantityUsed: 0, unitCost: 0, notes: notes ?? 'Stock returned via void', isActive: true },
    });

    logger.info(`Stock returned: Product ${productId}, Qty ${quantity}`);
    return batch;
  }

  async updateBatchQuantity(businessId: string, batchId: string, newQuantityUsed: number) {
    const batch = await prisma.stockBatch.findFirst({
      where: { id: batchId, product: { businessId } },
    });
    if (!batch) throw new NotFoundError('Stock batch');
    if (newQuantityUsed > batch.quantity) throw new ValidationError('Quantity used cannot exceed received quantity');
    if (newQuantityUsed < 0) throw new ValidationError('Quantity used cannot be negative');

    const updated = await prisma.stockBatch.update({
      where: { id: batchId },
      data: { quantityUsed: newQuantityUsed },
      include: { product: true },
    });

    logger.info(`Batch ${batch.batchNumber} updated: quantityUsed = ${newQuantityUsed}`);
    return updated;
  }

  async deactivateStockBatch(businessId: string, batchId: string) {
    const batch = await prisma.stockBatch.findFirst({
      where: { id: batchId, isActive: true, product: { businessId } },
    });
    if (!batch) throw new NotFoundError('Stock batch');

    const updated = await prisma.stockBatch.update({
      where: { id: batchId },
      data: { isActive: false },
      include: { product: true },
    });

    logger.info(`Batch ${batch.batchNumber} deactivated`);
    return updated;
  }

  async getLowStockProducts(businessId: string, storeId?: string) {
    const resolvedStoreId = await this.resolveStoreId(businessId, storeId);
    const products = await prisma.product.findMany({
      where: { businessId, storeId: resolvedStoreId, isActive: true },
      include: { stock: { where: { isActive: true, storeId: resolvedStoreId } } },
    });

    return products
      .map((product) => ({
        ...product,
        totalQuantity: product.stock.reduce((sum, batch) => sum + (batch.quantity - batch.quantityUsed), 0),
      }))
      .filter((p) => p.totalQuantity < p.reorderPoint);
  }

  async setReorderPoint(businessId: string, productId: number, reorderPoint: number) {
    if (reorderPoint < 0) throw new ValidationError('Reorder point must be non-negative');
    const product = await prisma.product.findFirst({ where: { id: productId, businessId } });
    if (!product) throw new NotFoundError('Product');
    return prisma.product.update({ where: { id: productId }, data: { reorderPoint } });
  }

  async getExpiredStockBatches(businessId: string, storeId?: string) {
    const resolvedStoreId = await this.resolveStoreId(businessId, storeId);
    return prisma.stockBatch.findMany({
      where: { isActive: true, storeId: resolvedStoreId, expiryDate: { lt: new Date() }, product: { businessId } },
      include: { product: true, store: true },
      orderBy: { expiryDate: 'asc' },
    });
  }
}

export const stockService = new StockService();
