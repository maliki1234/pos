import { prisma } from '../utils/prisma.js';
import { enforcePlanLimit } from '../utils/planLimits.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';

export class StoreService {
  async listStores(businessId: string) {
    return prisma.store.findMany({
      where: { businessId, isActive: true },
      include: {
        _count: { select: { users: true, transactions: true } },
      },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async getStore(businessId: string, storeId: string) {
    const store = await prisma.store.findFirst({
      where: { id: storeId, businessId },
      include: {
        _count: { select: { users: true, transactions: true } },
        users: { select: { id: true, name: true, email: true, role: true, isActive: true } },
      },
    });
    if (!store) throw new NotFoundError('Store');
    return store;
  }

  async createStore(businessId: string, data: { name: string; address?: string; phone?: string }) {
    await enforcePlanLimit(businessId, 'stores');

    // First store is always default
    const existingCount = await prisma.store.count({ where: { businessId } });

    return prisma.store.create({
      data: {
        businessId,
        name: data.name,
        address: data.address,
        phone: data.phone,
        isDefault: existingCount === 0,
      },
    });
  }

  async updateStore(
    businessId: string,
    storeId: string,
    data: { name?: string; address?: string; phone?: string; isDefault?: boolean }
  ) {
    const store = await prisma.store.findFirst({ where: { id: storeId, businessId } });
    if (!store) throw new NotFoundError('Store');

    // If setting as default, unset others first
    if (data.isDefault) {
      await prisma.store.updateMany({ where: { businessId }, data: { isDefault: false } });
    }

    return prisma.store.update({ where: { id: storeId }, data });
  }

  async deactivateStore(businessId: string, storeId: string) {
    const store = await prisma.store.findFirst({ where: { id: storeId, businessId } });
    if (!store) throw new NotFoundError('Store');
    if (store.isDefault) throw new ValidationError('Cannot deactivate the default store');

    // Unassign users from this store
    await prisma.user.updateMany({ where: { storeId }, data: { storeId: null } });

    return prisma.store.update({ where: { id: storeId }, data: { isActive: false } });
  }

  async assignUserToStore(businessId: string, userId: string, storeId: string | null) {
    const user = await prisma.user.findFirst({ where: { id: userId, businessId } });
    if (!user) throw new NotFoundError('User');

    if (storeId) {
      const store = await prisma.store.findFirst({ where: { id: storeId, businessId, isActive: true } });
      if (!store) throw new NotFoundError('Store');
    }

    return prisma.user.update({ where: { id: userId }, data: { storeId } });
  }

  /** Returns the default store for a business, or null if none exists */
  async getDefaultStore(businessId: string) {
    return prisma.store.findFirst({ where: { businessId, isDefault: true, isActive: true } });
  }
}

export const storeService = new StoreService();
