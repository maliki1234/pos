import { Prisma } from '@prisma/client';
import { mapProfitRow, type ProfitSourceRow } from './analyticsProfit.js';
import { prisma } from '../utils/prisma.js';

export class AnalyticsService {
  async getDashboardStats(businessId: string) {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const [todayTxns, lowStockCount] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          businessId,
          createdAt: { gte: startOfDay, lt: endOfDay },
          isVoided: false,
          transactionType: 'SALE',
        },
        select: { totalAmount: true },
      }),
      this.getLowStockCount(businessId),
    ]);

    const todayRevenue = todayTxns.reduce((s, t) => s + parseFloat(t.totalAmount.toString()), 0);
    const transactionCount = todayTxns.length;
    const avgOrder = transactionCount > 0 ? todayRevenue / transactionCount : 0;

    return { todayRevenue, transactionCount, avgOrder, lowStockCount };
  }

  private async getLowStockCount(businessId: string) {
    const products = await prisma.product.findMany({
      where: { businessId, isActive: true },
      include: { stock: { where: { isActive: true } } },
    });
    return products.filter((p) => {
      const qty = p.stock.reduce((s, b) => s + (b.quantity - b.quantityUsed), 0);
      return qty < p.reorderPoint;
    }).length;
  }

  async getSalesSummary(businessId: string, startDate: Date, endDate: Date) {
    const transactions = await prisma.transaction.findMany({
      where: {
        businessId,
        createdAt: { gte: startDate, lte: endDate },
        isVoided: false,
        transactionType: 'SALE',
      },
      select: { totalAmount: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    });

    const byDate = new Map<string, { totalRevenue: number; transactionCount: number }>();
    for (const t of transactions) {
      const key = t.createdAt.toISOString().slice(0, 10);
      const existing = byDate.get(key) ?? { totalRevenue: 0, transactionCount: 0 };
      existing.totalRevenue += parseFloat(t.totalAmount.toString());
      existing.transactionCount += 1;
      byDate.set(key, existing);
    }

    return Array.from(byDate.entries()).map(([date, data]) => ({ date, ...data }));
  }

  async getTopProducts(businessId: string, limit = 10, startDate?: Date, endDate?: Date) {
    type RawRow = { productId: number; name: string; totalQty: bigint; totalRevenue: bigint };

    const dateFilter =
      startDate && endDate
        ? Prisma.sql`AND t."createdAt" >= ${startDate} AND t."createdAt" <= ${endDate}`
        : startDate
        ? Prisma.sql`AND t."createdAt" >= ${startDate}`
        : endDate
        ? Prisma.sql`AND t."createdAt" <= ${endDate}`
        : Prisma.sql``;

    const rows = await prisma.$queryRaw<RawRow[]>`
      SELECT
        ti."productId",
        p.name,
        SUM(ti.quantity)::bigint    AS "totalQty",
        SUM(ti."lineTotal")::bigint AS "totalRevenue"
      FROM transaction_items ti
      JOIN products p          ON p.id = ti."productId"
      JOIN transactions t      ON t.id = ti."transactionId"
      WHERE t."businessId" = ${businessId}
        AND t."isVoided" = false AND t."transactionType" = 'SALE'
      ${dateFilter}
      GROUP BY ti."productId", p.name
      ORDER BY "totalRevenue" DESC
      LIMIT ${limit}
    `;

    return rows.map((r) => ({
      productId: r.productId,
      name: r.name,
      totalQty: Number(r.totalQty),
      totalRevenue: Number(r.totalRevenue),
    }));
  }

  async getPaymentMethodBreakdown(businessId: string, startDate?: Date, endDate?: Date) {
    const where: any = { businessId, isVoided: false, transactionType: 'SALE' as const };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const groups = await prisma.transaction.groupBy({
      by: ['paymentMethod'],
      where,
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    return groups.map((g) => ({
      paymentMethod: g.paymentMethod,
      totalAmount: parseFloat((g._sum.totalAmount ?? 0).toString()),
      count: g._count.id,
    }));
  }

  async getProfitMargin(businessId: string, startDate?: Date, endDate?: Date) {
    const dateFilter =
      startDate && endDate
        ? Prisma.sql`AND t."createdAt" >= ${startDate} AND t."createdAt" <= ${endDate}`
        : startDate
        ? Prisma.sql`AND t."createdAt" >= ${startDate}`
        : endDate
        ? Prisma.sql`AND t."createdAt" <= ${endDate}`
        : Prisma.sql``;

    const rows = await prisma.$queryRaw<RawRow[]>`
      SELECT
        ti."productId",
        p.name,
        SUM(ti.quantity)                                  AS "quantitySold",
        SUM(ti."lineTotal")                               AS "totalRevenue",
        sc."stockAverageCost"                             AS "stockAverageCost",
        pc."priceCost"                                    AS "priceCost"
      FROM transaction_items ti
      JOIN products p          ON p.id  = ti."productId"
      JOIN transactions t      ON t.id  = ti."transactionId"
      LEFT JOIN (
        SELECT
          "productId",
          SUM("unitCost" * quantity)::numeric / NULLIF(SUM(quantity), 0) AS "stockAverageCost"
        FROM stock_batches
        WHERE quantity > 0
          AND "unitCost" > 0
        GROUP BY "productId"
      ) sc ON sc."productId" = ti."productId"
      LEFT JOIN (
        SELECT
          "productId",
          MIN("costPrice") AS "priceCost"
        FROM product_prices
        WHERE "isActive" = true
        GROUP BY "productId"
      ) pc ON pc."productId" = ti."productId"
      WHERE t."businessId" = ${businessId}
        AND t."isVoided" = false AND t."transactionType" = 'SALE'
      ${dateFilter}
      GROUP BY ti."productId", p.name, sc."stockAverageCost", pc."priceCost"
      ORDER BY "totalRevenue" DESC
    `;

    return rows.map(mapProfitRow);
  }

  async getProfitSummary(businessId: string, startDate?: Date, endDate?: Date) {
    const productMargins = await this.getProfitMargin(businessId, startDate, endDate);
    const revenue = productMargins.reduce((sum, item) => sum + item.revenue, 0);
    const productCost = productMargins.reduce((sum, item) => sum + item.cost, 0);
    const grossProfit = revenue - productCost;

    const expenseWhere: any = { businessId, isActive: true };
    if (startDate || endDate) {
      expenseWhere.expenseDate = {};
      if (startDate) expenseWhere.expenseDate.gte = startDate;
      if (endDate) expenseWhere.expenseDate.lte = endDate;
    }

    const expenses = await prisma.expense.aggregate({
      where: expenseWhere,
      _sum: { amount: true },
    });
    const runningCosts = parseFloat((expenses._sum.amount ?? 0).toString());
    const netProfit = grossProfit - runningCosts;

    return {
      items: productMargins,
      summary: {
        revenue,
        productCost,
        grossProfit,
        runningCosts,
        netProfit,
        grossMarginPct: revenue > 0 ? Math.round((grossProfit / revenue) * 100 * 10) / 10 : 0,
        netMarginPct: revenue > 0 ? Math.round((netProfit / revenue) * 100 * 10) / 10 : 0,
      },
    };
  }

  async getStaffPerformance(businessId: string, startDate?: Date, endDate?: Date) {
    const where: any = { businessId, isVoided: false, transactionType: 'SALE' as const };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDate) where.createdAt.lte = endDate;
    }

    const groups = await prisma.transaction.groupBy({
      by: ['userId'],
      where,
      _sum: { totalAmount: true },
      _count: { id: true },
    });

    const userIds = groups.map((g) => g.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, businessId },
      select: { id: true, name: true, role: true },
    });
    const userMap = new Map(users.map((u) => [u.id, u]));

    return groups.map((g) => ({
      userId: g.userId,
      name: userMap.get(g.userId)?.name ?? 'Unknown',
      role: userMap.get(g.userId)?.role ?? 'CASHIER',
      totalRevenue: parseFloat((g._sum.totalAmount ?? 0).toString()),
      transactionCount: g._count.id,
      avgTransaction:
        g._count.id > 0
          ? parseFloat((g._sum.totalAmount ?? 0).toString()) / g._count.id
          : 0,
    }));
  }
}

type RawRow = ProfitSourceRow;
export const analyticsService = new AnalyticsService();
