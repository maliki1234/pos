import { prisma } from '../utils/prisma.js';
import { SubscriptionPlan, SubscriptionStatus, SubPaymentStatus, Prisma } from '@prisma/client';

export const PLAN_AMOUNTS: Record<string, Record<string, number>> = {
  STARTER:    { KES: 0,    UGX: 0,      TZS: 0,      RWF: 0,     ETB: 0    },
  BUSINESS:   { KES: 2500, UGX: 95000,  TZS: 58000,  RWF: 28000, ETB: 14500 },
  ENTERPRISE: { KES: 7500, UGX: 285000, TZS: 175000, RWF: 85000, ETB: 43500 },
};

export const PLAN_FEATURES: Record<string, string[]> = {
  STARTER:    ['pos', 'products_100', 'customers', 'receipts'],
  BUSINESS:   ['pos', 'products_unlimited', 'customers', 'receipts', 'analytics', 'credit_ledger', 'loyalty', 'low_stock', 'csv_export', 'multicurrency'],
  ENTERPRISE: ['pos', 'products_unlimited', 'customers', 'receipts', 'analytics', 'credit_ledger', 'loyalty', 'reconciliation', 'low_stock', 'csv_export', 'multicurrency', 'multi_branch', 'api_access', 'staff_unlimited'],
};

export const PLAN_ORDER = ['STARTER', 'BUSINESS', 'ENTERPRISE'];

class SubscriptionService {
  /** Get the subscription for a specific business (creates STARTER if none). */
  async getCurrent(businessId: string) {
    let sub = await prisma.subscription.findUnique({
      where: { businessId },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
    if (!sub) {
      sub = await prisma.subscription.create({
        data: { businessId, plan: 'STARTER', status: 'ACTIVE', amount: 0, currency: 'KES' },
        include: { payments: true },
      });
    }
    return sub;
  }

  async changePlan(
    businessId: string,
    plan: SubscriptionPlan,
    billingCycle: 'monthly' | 'annual',
    currency: string,
    notes?: string,
  ) {
    const monthlyAmount = PLAN_AMOUNTS[plan]?.[currency] ?? PLAN_AMOUNTS[plan]?.KES ?? 0;
    const amount = billingCycle === 'annual' ? Math.round(monthlyAmount * 0.8 * 12) : monthlyAmount;
    const sub = await this.getCurrent(businessId);
    return prisma.subscription.update({
      where: { id: sub.id },
      data: { plan, billingCycle, currency, amount: new Prisma.Decimal(amount), notes: notes ?? null, status: 'ACTIVE' },
      include: { payments: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
  }

  async recordPayment(
    subscriptionId: string,
    amount: number,
    currency: string,
    paymentMethod: string,
    reference: string | undefined,
    periodStart: Date,
    periodEnd: Date,
    notes?: string,
  ) {
    return prisma.subscriptionPayment.create({
      data: {
        subscriptionId,
        amount: new Prisma.Decimal(amount),
        currency,
        paymentMethod,
        reference: reference ?? null,
        status: 'PENDING',
        periodStart,
        periodEnd,
        notes: notes ?? null,
      },
    });
  }

  async confirmPayment(paymentId: string, confirmedByUserId: string, notes?: string) {
    const payment = await prisma.subscriptionPayment.findUniqueOrThrow({ where: { id: paymentId } });
    const [updatedPayment] = await prisma.$transaction([
      prisma.subscriptionPayment.update({
        where: { id: paymentId },
        data: { status: 'CONFIRMED', paidAt: new Date(), confirmedBy: confirmedByUserId, notes: notes ?? payment.notes },
      }),
      prisma.subscription.update({
        where: { id: payment.subscriptionId },
        data: { status: 'ACTIVE', endDate: payment.periodEnd, startDate: payment.periodStart },
      }),
    ]);
    return updatedPayment;
  }

  async failPayment(paymentId: string, notes?: string) {
    return prisma.subscriptionPayment.update({
      where: { id: paymentId },
      data: { status: 'FAILED', notes: notes ?? undefined },
    });
  }

  async refundPayment(paymentId: string, notes?: string) {
    return prisma.subscriptionPayment.update({
      where: { id: paymentId },
      data: { status: 'REFUNDED', notes: notes ?? undefined },
    });
  }

  async suspend(businessId: string, notes?: string) {
    const sub = await this.getCurrent(businessId);
    return prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'SUSPENDED', notes: notes ?? sub.notes },
    });
  }

  async reinstate(businessId: string) {
    const sub = await this.getCurrent(businessId);
    return prisma.subscription.update({ where: { id: sub.id }, data: { status: 'ACTIVE' } });
  }

  async cancel(businessId: string, notes?: string) {
    const sub = await this.getCurrent(businessId);
    return prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'CANCELLED', cancelledAt: new Date(), notes: notes ?? sub.notes },
    });
  }

  async getPaymentHistory(businessId: string) {
    const sub = await this.getCurrent(businessId);
    return prisma.subscriptionPayment.findMany({
      where: { subscriptionId: sub.id },
      include: { confirmer: { select: { id: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  planHasFeature(plan: SubscriptionPlan, feature: string): boolean {
    return PLAN_FEATURES[plan]?.includes(feature) ?? false;
  }

  meetsMinPlan(currentPlan: SubscriptionPlan, minPlan: SubscriptionPlan): boolean {
    return PLAN_ORDER.indexOf(currentPlan) >= PLAN_ORDER.indexOf(minPlan);
  }
}

export const subscriptionService = new SubscriptionService();
