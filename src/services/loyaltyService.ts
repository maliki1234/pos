import { Prisma, LoyaltyTier } from '@prisma/client';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { prisma } from '../utils/prisma.js';

type TxClient = Prisma.TransactionClient;

const POINTS_PER_KES = 0.1;
const POINT_VALUE_KES = 1;
const SILVER_THRESHOLD = 500;
const GOLD_THRESHOLD = 2000;

export class LoyaltyService {
  private recalculateTier(lifetimePoints: number): LoyaltyTier {
    if (lifetimePoints >= GOLD_THRESHOLD) return 'GOLD';
    if (lifetimePoints >= SILVER_THRESHOLD) return 'SILVER';
    return 'BRONZE';
  }

  async getOrCreateAccount(businessId: string, customerId: string, tx?: TxClient) {
    const db = tx ?? prisma;
    const existing = await db.loyaltyAccount.findUnique({ where: { customerId } });
    if (existing) return existing;

    return db.loyaltyAccount.create({
      data: { businessId, customerId, totalPoints: 0, lifetimePoints: 0, tier: 'BRONZE' },
    });
  }

  async getAccount(businessId: string, customerId: string) {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, businessId } });
    if (!customer) throw new NotFoundError('Customer');

    const account = await prisma.loyaltyAccount.findUnique({
      where: { customerId },
      include: { pointsHistory: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });

    if (!account) {
      return { totalPoints: 0, lifetimePoints: 0, tier: 'BRONZE' as LoyaltyTier, pointsHistory: [] };
    }

    const nextTierPoints =
      account.tier === 'BRONZE' ? SILVER_THRESHOLD :
      account.tier === 'SILVER' ? GOLD_THRESHOLD : null;

    return { ...account, nextTierPoints, pointValueKES: POINT_VALUE_KES };
  }

  async earnPoints(businessId: string, customerId: string, transactionId: string, purchaseAmountKES: number) {
    const pointsEarned = Math.floor(purchaseAmountKES * POINTS_PER_KES);
    if (pointsEarned <= 0) return null;

    return prisma.$transaction(async (tx) => {
      const account = await this.getOrCreateAccount(businessId, customerId, tx);
      const newTotal = account.totalPoints + pointsEarned;
      const newLifetime = account.lifetimePoints + pointsEarned;
      const newTier = this.recalculateTier(newLifetime);

      const updated = await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: { totalPoints: newTotal, lifetimePoints: newLifetime, tier: newTier },
      });

      await tx.loyaltyTransaction.create({
        data: {
          loyaltyAccountId: account.id,
          transactionId,
          type: 'EARN',
          points: pointsEarned,
          description: `Earned ${pointsEarned} pts on KES ${purchaseAmountKES.toFixed(2)} purchase`,
        },
      });

      logger.info(`Loyalty: ${pointsEarned} pts earned for customer ${customerId}. Total: ${newTotal}`);
      return updated;
    });
  }

  async redeemPoints(businessId: string, customerId: string, pointsToRedeem: number, tx?: TxClient) {
    const db = tx ?? prisma;

    const account = await db.loyaltyAccount.findUnique({ where: { customerId } });
    if (!account) throw new NotFoundError('Loyalty account');
    if (pointsToRedeem <= 0) throw new ValidationError('Points to redeem must be greater than 0');
    if (account.totalPoints < pointsToRedeem) {
      throw new ValidationError(
        `Insufficient points. Available: ${account.totalPoints}, Requested: ${pointsToRedeem}`
      );
    }

    const kesValue = pointsToRedeem * POINT_VALUE_KES;
    const newTotal = account.totalPoints - pointsToRedeem;

    await db.loyaltyAccount.update({ where: { id: account.id }, data: { totalPoints: newTotal } });
    await db.loyaltyTransaction.create({
      data: {
        loyaltyAccountId: account.id,
        type: 'REDEEM',
        points: -pointsToRedeem,
        description: `Redeemed ${pointsToRedeem} pts for KES ${kesValue} discount`,
      },
    });

    logger.info(`Loyalty: ${pointsToRedeem} pts redeemed for customer ${customerId}. KES value: ${kesValue}`);
    return { pointsRedeemed: pointsToRedeem, kesValue, remainingPoints: newTotal };
  }

  async adjustPoints(businessId: string, customerId: string, points: number, reason: string, userId: string) {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, businessId } });
    if (!customer) throw new NotFoundError('Customer');

    return prisma.$transaction(async (tx) => {
      const account = await this.getOrCreateAccount(businessId, customerId, tx);
      const newTotal = Math.max(0, account.totalPoints + points);
      const newLifetime = points > 0 ? account.lifetimePoints + points : account.lifetimePoints;
      const newTier = this.recalculateTier(newLifetime);

      const updated = await tx.loyaltyAccount.update({
        where: { id: account.id },
        data: { totalPoints: newTotal, lifetimePoints: newLifetime, tier: newTier },
      });

      await tx.loyaltyTransaction.create({
        data: {
          loyaltyAccountId: account.id,
          type: 'ADJUSTMENT',
          points,
          description: `Manual adjustment by user ${userId}: ${reason}`,
        },
      });

      logger.info(`Loyalty: manual adjustment of ${points} pts for customer ${customerId}`);
      return updated;
    });
  }
}

export const loyaltyService = new LoyaltyService();
