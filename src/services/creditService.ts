import { Prisma, PaymentMethod, CreditStatus } from '@prisma/client';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { prisma } from '../utils/prisma.js';

type TxClient = Prisma.TransactionClient;

export class CreditService {
  async createCreditEntry(
    businessId: string,
    transactionId: string,
    customerId: string,
    amount: number,
    dueDate?: Date,
    notes?: string,
    tx?: TxClient
  ) {
    const db = tx ?? prisma;
    const entry = await db.creditLedger.create({
      data: {
        businessId,
        transactionId,
        customerId,
        originalAmount: amount.toString(),
        outstandingBalance: amount.toString(),
        dueDate,
        notes,
        status: 'OUTSTANDING',
      },
      include: { customer: true, transaction: true },
    });
    logger.info(`Credit entry created: ${entry.id} for customer ${customerId}, amount ${amount}`);
    return entry;
  }

  async getCustomerLedger(businessId: string, customerId: string) {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, businessId } });
    if (!customer) throw new NotFoundError('Customer');

    const entries = await prisma.creditLedger.findMany({
      where: { customerId, businessId },
      include: {
        repayments: { orderBy: { createdAt: 'desc' } },
        transaction: { select: { transactionNo: true, createdAt: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalOutstanding = entries.reduce(
      (sum, e) => sum + parseFloat(e.outstandingBalance.toString()),
      0
    );

    return { customer, entries, totalOutstanding };
  }

  async getLedgerEntry(businessId: string, id: string) {
    const entry = await prisma.creditLedger.findFirst({
      where: { id, businessId },
      include: {
        customer: true,
        repayments: { include: { user: { select: { name: true } } }, orderBy: { createdAt: 'desc' } },
        transaction: { select: { transactionNo: true, totalAmount: true, createdAt: true } },
      },
    });
    if (!entry) throw new NotFoundError('Credit ledger entry');
    return entry;
  }

  async recordRepayment(
    businessId: string,
    creditLedgerId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    userId: string,
    notes?: string
  ) {
    const entry = await prisma.creditLedger.findFirst({ where: { id: creditLedgerId, businessId } });
    if (!entry) throw new NotFoundError('Credit ledger entry');
    if (entry.status === 'SETTLED') throw new ValidationError('This credit has already been settled');

    const outstanding = parseFloat(entry.outstandingBalance.toString());
    if (amount <= 0) throw new ValidationError('Repayment amount must be greater than 0');
    if (amount > outstanding) throw new ValidationError(`Amount exceeds outstanding balance of ${outstanding}`);

    return prisma.$transaction(async (tx) => {
      const repayment = await tx.creditRepayment.create({
        data: { creditLedgerId, amount: amount.toString(), paymentMethod, notes, recordedBy: userId },
        include: { user: { select: { name: true } } },
      });

      const newAmountPaid = parseFloat(entry.amountPaid.toString()) + amount;
      const newOutstanding = parseFloat(entry.originalAmount.toString()) - newAmountPaid;
      const newStatus: CreditStatus = newOutstanding <= 0 ? 'SETTLED' : 'PARTIAL';

      const updated = await tx.creditLedger.update({
        where: { id: creditLedgerId },
        data: {
          amountPaid: newAmountPaid.toString(),
          outstandingBalance: Math.max(0, newOutstanding).toString(),
          status: newStatus,
        },
      });

      logger.info(`Repayment of ${amount} recorded for credit ${creditLedgerId}. Status: ${newStatus}`);
      return { repayment, ledger: updated };
    });
  }

  /** Search all outstanding credit entries across customers, optionally filtered by name/phone */
  async searchAllCredit(businessId: string, query?: string) {
    await this.markOverdue(businessId);

    const where: Prisma.CreditLedgerWhereInput = {
      businessId,
      status: { not: 'SETTLED' },
      ...(query
        ? {
            customer: {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { phone: { contains: query } },
              ],
            },
          }
        : {}),
    };

    const entries = await prisma.creditLedger.findMany({
      where,
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        transaction: { select: { transactionNo: true, createdAt: true } },
        repayments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
      orderBy: [{ status: 'asc' }, { dueDate: 'asc' }],
    });

    return entries;
  }

  /** Get a quick credit summary for one customer (used in cashier page) */
  async getCustomerCreditSummary(businessId: string, customerId: string) {
    const entries = await prisma.creditLedger.findMany({
      where: { businessId, customerId, status: { not: 'SETTLED' } },
      select: { outstandingBalance: true, status: true, dueDate: true },
    });
    const total = entries.reduce((s, e) => s + parseFloat(e.outstandingBalance.toString()), 0);
    const overdue = entries.filter(e => e.status === 'OVERDUE').length;
    return { totalOutstanding: total, openEntries: entries.length, overdueCount: overdue };
  }

  async getAgingReport(businessId: string) {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    const [current, thirtyToSixty, overSixty, noDate] = await Promise.all([
      prisma.creditLedger.findMany({
        where: { businessId, status: { not: 'SETTLED' }, dueDate: { gte: thirtyDaysAgo, lt: now } },
        include: { customer: { select: { name: true } } },
      }),
      prisma.creditLedger.findMany({
        where: { businessId, status: { not: 'SETTLED' }, dueDate: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } },
        include: { customer: { select: { name: true } } },
      }),
      prisma.creditLedger.findMany({
        where: { businessId, status: { not: 'SETTLED' }, dueDate: { lt: sixtyDaysAgo } },
        include: { customer: { select: { name: true } } },
      }),
      prisma.creditLedger.findMany({
        where: { businessId, status: { not: 'SETTLED' }, dueDate: null },
        include: { customer: { select: { name: true } } },
      }),
    ]);

    const summarise = (entries: typeof current) => ({
      count: entries.length,
      totalOutstanding: entries.reduce((s, e) => s + parseFloat(e.outstandingBalance.toString()), 0),
      entries,
    });

    return {
      current: summarise(current),
      thirtyToSixty: summarise(thirtyToSixty),
      overSixty: summarise(overSixty),
      noDueDate: summarise(noDate),
    };
  }

  async markOverdue(businessId: string) {
    const result = await prisma.creditLedger.updateMany({
      where: {
        businessId,
        status: { in: ['OUTSTANDING', 'PARTIAL'] },
        dueDate: { lt: new Date() },
      },
      data: { status: 'OVERDUE' },
    });
    logger.info(`Marked ${result.count} credit entries as OVERDUE for business ${businessId}`);
    return result;
  }
}

export const creditService = new CreditService();
