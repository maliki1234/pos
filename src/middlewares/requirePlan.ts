import { Request, Response, NextFunction } from 'express';
import { subscriptionService } from '../services/subscriptionService.js';
import { SubscriptionPlan } from '@prisma/client';

/**
 * Middleware factory — gate a route behind a minimum subscription plan.
 * Usage: router.get('/analytics', authenticate, requirePlan('BUSINESS'), handler)
 */
export function requirePlan(minPlan: SubscriptionPlan) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const businessId = req.user?.businessId;
      if (!businessId) {
        return res.status(401).json({ success: false, message: 'Authentication required' });
      }

      const sub = await subscriptionService.getCurrent(businessId);
      if (sub.status !== 'ACTIVE') {
        return res.status(402).json({
          success: false,
          message: `Your subscription is ${sub.status.toLowerCase()}. Please renew to access this feature.`,
        });
      }
      if (!subscriptionService.meetsMinPlan(sub.plan, minPlan)) {
        return res.status(403).json({
          success: false,
          message: `This feature requires the ${minPlan} plan or higher. Current plan: ${sub.plan}.`,
          requiredPlan: minPlan,
          currentPlan: sub.plan,
        });
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
