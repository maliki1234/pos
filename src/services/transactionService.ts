import { Prisma, PaymentMethod, PaymentStatus } from '@prisma/client';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { stockService } from './stockService.js';
import { priceService } from './priceService.js';
import { creditService } from './creditService.js';
import { loyaltyService } from './loyaltyService.js';
import { prisma } from '../utils/prisma.js';

export interface CreateTransactionItem {
  productId: number;
  quantity: number;
  discount?: number;
}

export interface CreateTransactionRequest {
  businessId: string;
  storeId?: string;
  customerId?: string;
  userId: string;
  items: CreateTransactionItem[];
  paymentMethod: PaymentMethod;
  payments?: { method: string; amount: number }[]; // multi-tender splits
  mpesaRef?: string;
  notes?: string;
  dueDate?: Date;
  loyaltyPointsToRedeem?: number;
}

interface ProcessedItem {
  productId: number;
  quantity: number;
  unitPrice: number;
  discount: number;
  lineTotal: number;
}

export class TransactionService {
  private generateTransactionNo(): string {
    const date = new Date();
    const timestamp = date.getTime().toString().slice(-6);
    const random = Math.random().toString(36).substr(2, 5).toUpperCase();
    return `TXN-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}-${timestamp}-${random}`;
  }

  async createTransaction(data: CreateTransactionRequest) {
    if (data.paymentMethod === 'CREDIT' && !data.customerId) {
      throw new ValidationError('Credit transactions require a customer to be selected');
    }

    const txn = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findFirst({ where: { id: data.userId, businessId: data.businessId } });
      if (!user) throw new NotFoundError('User');

      let customer = null;
      if (data.customerId) {
        customer = await tx.customer.findFirst({ where: { id: data.customerId, businessId: data.businessId } });
        if (!customer) throw new NotFoundError('Customer');
      }

      if (data.items.length === 0) throw new ValidationError('Transaction must have at least one item');

      let subtotal = 0;
      let totalDiscount = 0;
      const processedItems: ProcessedItem[] = [];

      let loyaltyDiscount = 0;
      if (data.loyaltyPointsToRedeem && data.loyaltyPointsToRedeem > 0 && data.customerId) {
        const redemption = await loyaltyService.redeemPoints(data.businessId, data.customerId, data.loyaltyPointsToRedeem, tx);
        loyaltyDiscount = redemption.kesValue;
      }

      for (const item of data.items) {
        const product = await tx.product.findFirst({ where: { id: item.productId, businessId: data.businessId } });
        if (!product) throw new NotFoundError(`Product with ID ${item.productId}`);

        await stockService.deductStockFIFO(item.productId, item.quantity, tx);

        const customerType = customer?.customerType ?? 'RETAIL';
        const pricing = await priceService.calculateLineTotal(item.productId, customerType, item.quantity, tx);

        const manualDiscount = item.discount ?? 0;
        processedItems.push({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: pricing.unitPrice,
          discount: pricing.discount + manualDiscount,
          lineTotal: pricing.lineTotal - manualDiscount,
        });

        subtotal += pricing.lineTotal - manualDiscount;
        totalDiscount += pricing.discount * item.quantity + manualDiscount;
      }

      subtotal = Math.max(0, subtotal - loyaltyDiscount);
      totalDiscount += loyaltyDiscount;

      const taxRate = 0.1;
      const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
      const totalAmount = subtotal + taxAmount;

      const paymentStatus: PaymentStatus = data.paymentMethod === 'CREDIT' ? 'PENDING' : 'COMPLETED';

      const transaction = await tx.transaction.create({
        data: {
          businessId: data.businessId,
          storeId: data.storeId ?? null,
          transactionNo: this.generateTransactionNo(),
          customerId: data.customerId,
          userId: data.userId,
          transactionType: 'SALE',
          subtotal: subtotal.toString(),
          discountAmount: totalDiscount.toString(),
          taxAmount: taxAmount.toString(),
          totalAmount: totalAmount.toString(),
          paymentMethod: data.paymentMethod,
          paymentStatus,
          payments: data.payments ? data.payments : undefined,
          mpesaRef: data.mpesaRef ?? null,
          notes: data.notes,
        },
      });

      // ── eTIMS optional submission ───────────────────────────────────────────
      try {
        const biz = await tx.business.findUnique({ where: { id: data.businessId }, select: { etimsEnabled: true, etimsPin: true, etimsBhfId: true } });
        if (biz?.etimsEnabled && biz.etimsPin && biz.etimsBhfId) {
          // Fire-and-forget eTIMS submission (does not block the sale)
          setImmediate(async () => {
            try {
              const payload = {
                tin: biz.etimsPin,
                bhfId: biz.etimsBhfId,
                invcNo: transaction.transactionNo,
                salesTyCd: 'N',
                rcptTyCd: 'S',
                pmtTyCd: data.paymentMethod === 'CASH' ? 'C' : data.paymentMethod === 'MOBILE_MONEY' ? 'M' : 'O',
                totTaxblAmt: subtotal,
                totTax: taxAmount,
                totAmt: totalAmount,
                prchrAcptcYn: 'N',
              };
              const res = await fetch(`https://etims-api.kra.go.ke/etims-api/trnsSalesSave`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', tin: biz.etimsPin!, bhfId: biz.etimsBhfId! },
                body: JSON.stringify(payload),
              });
              logger.info(`eTIMS submission for ${transaction.transactionNo}: HTTP ${res.status}`);
            } catch (e) { logger.warn('eTIMS submission failed (non-fatal):', e); }
          });
        }
      } catch (e) { /* non-fatal */ }

      for (const item of processedItems) {
        await tx.transactionItem.create({
          data: {
            transactionId: transaction.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toString(),
            discount: item.discount.toString(),
            lineTotal: item.lineTotal.toString(),
          },
        });
      }

      if (data.paymentMethod === 'CREDIT' && data.customerId) {
        await creditService.createCreditEntry(data.businessId, transaction.id, data.customerId, totalAmount, data.dueDate, data.notes, tx);
      }

      logger.info(`Transaction created: ${transaction.transactionNo}`);
      return transaction;
    });

    if (data.customerId && data.paymentMethod !== 'CREDIT') {
      const full = await this.getTransaction(txn.id);
      const amount = parseFloat(full.totalAmount.toString());
      await loyaltyService.earnPoints(data.businessId, data.customerId, txn.id, amount).catch((err) => {
        logger.error('Loyalty earn failed (non-fatal):', err);
      });
    }

    return this.getTransaction(txn.id);
  }

  async getTransaction(id: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        customer: true,
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });
    if (!transaction) throw new NotFoundError('Transaction');
    return transaction;
  }

  async getTransactionByNo(transactionNo: string) {
    const transaction = await prisma.transaction.findUnique({
      where: { transactionNo },
      include: {
        items: { include: { product: true } },
        customer: true,
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });
    if (!transaction) throw new NotFoundError('Transaction');
    return transaction;
  }

  async listTransactions(businessId: string, filters: {
    customerId?: string;
    userId?: string;
    paymentStatus?: PaymentStatus;
    startDate?: Date;
    endDate?: Date;
    skip?: number;
    take?: number;
  }) {
    const where: Prisma.TransactionWhereInput = { businessId };

    if (filters.customerId) where.customerId = filters.customerId;
    if (filters.userId) where.userId = filters.userId;
    if (filters.paymentStatus) where.paymentStatus = filters.paymentStatus;

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) (where.createdAt as Prisma.DateTimeFilter).gte = filters.startDate;
      if (filters.endDate) (where.createdAt as Prisma.DateTimeFilter).lte = filters.endDate;
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: { items: true, customer: true, user: { select: { id: true, name: true, role: true } } },
        orderBy: { createdAt: 'desc' },
        skip: filters.skip ?? 0,
        take: filters.take ?? 50,
      }),
      prisma.transaction.count({ where }),
    ]);

    return { transactions, total };
  }

  async returnTransaction(
    businessId: string,
    originalId: string,
    returnItems: { productId: number; quantity: number }[],
    reason: string
  ) {
    if (!reason?.trim()) throw new ValidationError('Return reason is required');
    if (!returnItems?.length) throw new ValidationError('At least one item is required for a return');

    const original = await prisma.transaction.findFirst({
      where: { id: originalId, businessId },
      include: { items: { include: { product: { select: { name: true } } } } },
    });
    if (!original) throw new NotFoundError('Transaction');
    if (original.isVoided) throw new ValidationError('Cannot return items from a voided transaction');
    if (original.transactionType === 'RETURN') throw new ValidationError('Cannot return a return transaction');

    // Validate return quantities against original
    for (const ri of returnItems) {
      const orig = original.items.find(i => i.productId === ri.productId);
      if (!orig) throw new ValidationError(`Product ${ri.productId} was not in the original transaction`);
      if (ri.quantity <= 0) throw new ValidationError('Return quantity must be greater than 0');
      if (ri.quantity > orig.quantity) throw new ValidationError(
        `Cannot return more than the original quantity (${orig.quantity}) for product "${orig.product.name}"`
      );
    }

    return prisma.$transaction(async (tx) => {
      // Restore stock for each returned item
      for (const ri of returnItems) {
        await stockService.returnStock(ri.productId, ri.quantity, tx, `Return from ${original.transactionNo}: ${reason}`);
      }

      // Calculate return total
      let returnTotal = 0;
      const returnLineItems = returnItems.map(ri => {
        const orig = original.items.find(i => i.productId === ri.productId)!;
        const lineTotal = (parseFloat(orig.unitPrice.toString()) * ri.quantity);
        returnTotal += lineTotal;
        return { productId: ri.productId, quantity: ri.quantity, unitPrice: orig.unitPrice, lineTotal };
      });

      const returnTxn = await tx.transaction.create({
        data: {
          businessId,
          transactionNo: `RTN-${this.generateTransactionNo().replace('TXN-', '')}`,
          customerId: original.customerId,
          userId: original.userId,
          transactionType: 'RETURN',
          subtotal: returnTotal.toString(),
          discountAmount: '0',
          taxAmount: '0',
          totalAmount: returnTotal.toString(),
          paymentMethod: original.paymentMethod,
          paymentStatus: 'REFUNDED',
          notes: `Return from ${original.transactionNo}. Reason: ${reason}`,
          items: {
            create: returnLineItems.map(li => ({
              productId: li.productId,
              quantity: li.quantity,
              unitPrice: li.unitPrice,
              discount: 0,
              lineTotal: li.lineTotal.toString(),
            })),
          },
        },
        include: { items: true },
      });

      logger.info(`Return created: ${returnTxn.transactionNo} from ${original.transactionNo}`);
      return returnTxn;
    });
  }

  async voidTransaction(businessId: string, id: string, reason: string) {
    if (!reason || reason.trim().length === 0) throw new ValidationError('Void reason is required');

    const transaction = await prisma.transaction.findFirst({ where: { id, businessId }, include: { items: true } });
    if (!transaction) throw new NotFoundError('Transaction');
    if (transaction.isVoided) throw new ValidationError('Transaction is already voided');

    await prisma.$transaction(async (tx) => {
      for (const item of transaction.items) {
        await stockService.returnStock(item.productId, item.quantity, tx, `Void of ${transaction.transactionNo}: ${reason}`);
      }

      await tx.transaction.update({
        where: { id },
        data: { isVoided: true, voidReason: reason, paymentStatus: 'REFUNDED' },
      });

      await tx.creditLedger.updateMany({
        where: { transactionId: id },
        data: { status: 'SETTLED', outstandingBalance: '0', notes: `Voided: ${reason}` },
      });
    });

    logger.info(`Transaction voided: ${transaction.transactionNo}`);
    return this.getTransaction(id);
  }
}

export const transactionService = new TransactionService();
