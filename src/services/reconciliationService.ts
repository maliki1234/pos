import { prisma } from '../utils/prisma.js';
import logger from '../utils/logger.js';

export interface ReconciliationReportData {
  reportDate: Date;
  totalCash: number;
  totalMobileMoney: number;
  totalCard: number;
  totalCheque: number;
  totalBankTransfer: number;
  totalCredit: number;
  totalRevenue: number;
  expectedCash: number;
  transactionCount: number;
  voidCount: number;
  voidTotal: number;
  grossProfit: number;
  totalCOGS: number;
  paymentDetails: Array<{ paymentMethod: string; count: number; total: number }>;
  voidedTransactions: Array<{ transactionNo: string; totalAmount: number; voidReason: string | null }>;
}

export class ReconciliationService {
  async generateReport(businessId: string, date: Date, cashierId?: string): Promise<ReconciliationReportData> {
    const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const where: any = { businessId, createdAt: { gte: startOfDay, lt: endOfDay } };
    if (cashierId) where.userId = cashierId;

    const [saleTxns, voidedTxns] = await Promise.all([
      prisma.transaction.findMany({
        where: { ...where, isVoided: false, transactionType: 'SALE' },
        select: { paymentMethod: true, totalAmount: true, subtotal: true },
      }),
      prisma.transaction.findMany({
        where: { ...where, isVoided: true },
        select: { transactionNo: true, totalAmount: true, voidReason: true },
      }),
    ]);

    const methodTotals: Record<string, number> = {};
    for (const t of saleTxns) {
      const amount = parseFloat(t.totalAmount.toString());
      methodTotals[t.paymentMethod] = (methodTotals[t.paymentMethod] ?? 0) + amount;
    }

    const totalCash = methodTotals['CASH'] ?? 0;
    const totalMobileMoney = methodTotals['MOBILE_MONEY'] ?? 0;
    const totalCard = methodTotals['CARD'] ?? 0;
    const totalCheque = methodTotals['CHEQUE'] ?? 0;
    const totalBankTransfer = methodTotals['BANK_TRANSFER'] ?? 0;
    const totalCredit = methodTotals['CREDIT'] ?? 0;
    const totalRevenue = saleTxns.reduce((s, t) => s + parseFloat(t.totalAmount.toString()), 0);
    const voidTotal = voidedTxns.reduce((s, t) => s + parseFloat(t.totalAmount.toString()), 0);

    const cogsRows = await prisma.$queryRaw<{ totalCost: bigint }[]>`
      SELECT SUM(pp."costPrice" * ti.quantity)::bigint AS "totalCost"
      FROM transaction_items ti
      JOIN transactions t ON t.id = ti."transactionId"
      LEFT JOIN LATERAL (
        SELECT "costPrice"
        FROM product_prices pp2
        WHERE pp2."productId" = ti."productId" AND pp2."isActive" = true
        ORDER BY pp2."minQuantity" DESC
        LIMIT 1
      ) pp ON true
      WHERE t."businessId" = ${businessId}
        AND t."createdAt" >= ${startOfDay} AND t."createdAt" < ${endOfDay}
        AND t."isVoided" = false AND t."transactionType" = 'SALE'
        ${cashierId ? Prisma.sql`AND t."userId" = ${cashierId}` : Prisma.sql``}
    `;
    const totalCOGS = Number(cogsRows[0]?.totalCost ?? 0);
    const grossProfit = totalRevenue - totalCOGS;

    const paymentDetails = Object.entries(methodTotals).map(([paymentMethod, total]) => ({
      paymentMethod,
      count: saleTxns.filter((t) => t.paymentMethod === paymentMethod).length,
      total,
    }));

    return {
      reportDate: startOfDay,
      totalCash, totalMobileMoney, totalCard, totalCheque, totalBankTransfer, totalCredit,
      totalRevenue,
      expectedCash: totalCash,
      transactionCount: saleTxns.length,
      voidCount: voidedTxns.length,
      voidTotal,
      grossProfit,
      totalCOGS,
      paymentDetails,
      voidedTransactions: voidedTxns.map((t) => ({
        transactionNo: t.transactionNo,
        totalAmount: parseFloat(t.totalAmount.toString()),
        voidReason: t.voidReason,
      })),
    };
  }

  async saveReport(
    businessId: string,
    reportData: ReconciliationReportData,
    actualCash: number,
    discrepancyNotes: string | undefined,
    submittedBy: string
  ) {
    const cashDiscrepancy = actualCash - reportData.expectedCash;

    const report = await prisma.reconciliationReport.create({
      data: {
        businessId,
        reportDate: reportData.reportDate,
        submittedBy,
        totalCash: reportData.totalCash.toString(),
        totalMobileMoney: reportData.totalMobileMoney.toString(),
        totalCard: reportData.totalCard.toString(),
        totalCheque: reportData.totalCheque.toString(),
        totalBankTransfer: reportData.totalBankTransfer.toString(),
        totalCredit: reportData.totalCredit.toString(),
        totalRevenue: reportData.totalRevenue.toString(),
        expectedCash: reportData.expectedCash.toString(),
        actualCash: actualCash.toString(),
        cashDiscrepancy: cashDiscrepancy.toString(),
        discrepancyNotes,
        transactionCount: reportData.transactionCount,
        voidCount: reportData.voidCount,
        voidTotal: reportData.voidTotal.toString(),
        grossProfit: reportData.grossProfit.toString(),
        totalCOGS: reportData.totalCOGS.toString(),
      },
      include: { user: { select: { name: true } } },
    });

    logger.info(`EOD Reconciliation report saved for ${reportData.reportDate.toISOString().slice(0, 10)}`);
    return report;
  }

  async getReport(businessId: string, id: string) {
    const report = await prisma.reconciliationReport.findFirst({
      where: { id, businessId },
      include: { user: { select: { name: true } } },
    });
    if (!report) {
      const { NotFoundError } = await import('../utils/errors.js');
      throw new NotFoundError('Reconciliation report');
    }
    return report;
  }

  async listReports(businessId: string, startDate?: Date, endDate?: Date) {
    const where: any = { businessId };
    if (startDate || endDate) {
      where.reportDate = {};
      if (startDate) where.reportDate.gte = startDate;
      if (endDate) where.reportDate.lte = endDate;
    }
    return prisma.reconciliationReport.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: { reportDate: 'desc' },
      take: 90,
    });
  }
}

import { Prisma } from '@prisma/client';
export const reconciliationService = new ReconciliationService();
