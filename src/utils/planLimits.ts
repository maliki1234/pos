import { SubscriptionPlan } from '@prisma/client';
import { prisma } from './prisma.js';
import { AppError } from './errors.js';

export const PLAN_LIMITS: Record<SubscriptionPlan, { stores: number | null; users: number | null }> = {
  STARTER:    { stores: 1,    users: 3    },
  BUSINESS:   { stores: 3,    users: null },
  ENTERPRISE: { stores: null, users: null },
};

export async function getBusinessPlan(businessId: string): Promise<SubscriptionPlan> {
  const sub = await prisma.subscription.findUnique({
    where: { businessId },
    select: { plan: true },
  });
  return sub?.plan ?? 'STARTER';
}

export async function enforcePlanLimit(
  businessId: string,
  resource: 'stores' | 'users'
): Promise<void> {
  const plan = await getBusinessPlan(businessId);
  const limit = PLAN_LIMITS[plan][resource];
  if (limit === null) return; // unlimited

  let count = 0;
  if (resource === 'stores') {
    count = await prisma.store.count({ where: { businessId, isActive: true } });
  } else {
    count = await prisma.user.count({ where: { businessId, isActive: true } });
  }

  if (count >= limit) {
    const planName = plan.charAt(0) + plan.slice(1).toLowerCase();
    const resourceLabel = resource === 'stores' ? 'store' : 'staff account';
    throw new AppError(
      403,
      `${planName} plan allows a maximum of ${limit} ${resourceLabel}${limit !== 1 ? 's' : ''}. Upgrade your plan to add more.`
    );
  }
}
