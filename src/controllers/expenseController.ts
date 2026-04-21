import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { prisma } from '../utils/prisma.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import logger from '../utils/logger.js';

const frequencyValues = ['ONE_TIME', 'DAILY', 'WEEKLY', 'MONTHLY'];

const expenseSchema = Joi.object({
  category: Joi.string().trim().required(),
  description: Joi.string().trim().optional().allow('', null),
  amount: Joi.number().positive().required(),
  frequency: Joi.string().valid(...frequencyValues).optional(),
  expenseDate: Joi.date().optional(),
  storeId: Joi.string().uuid().optional().allow('', null),
});

const updateExpenseSchema = Joi.object({
  category: Joi.string().trim().optional(),
  description: Joi.string().trim().optional().allow('', null),
  amount: Joi.number().positive().optional(),
  frequency: Joi.string().valid(...frequencyValues).optional(),
  expenseDate: Joi.date().optional(),
  storeId: Joi.string().uuid().optional().allow('', null),
}).min(1);

const bid = (req: Request) => req.user!.businessId;

async function assertStoreBelongsToBusiness(businessId: string, storeId?: string | null) {
  if (!storeId) return;

  const store = await prisma.store.findFirst({
    where: { id: storeId, businessId, isActive: true },
    select: { id: true },
  });

  if (!store) throw new NotFoundError('Store');
}

function normalizeExpensePayload(value: any, defaults = false) {
  const payload: any = {};
  if (value.category !== undefined) payload.category = value.category;
  if (value.description !== undefined) payload.description = value.description || null;
  if (value.amount !== undefined) payload.amount = value.amount;
  if (value.frequency !== undefined || defaults) payload.frequency = value.frequency || 'ONE_TIME';
  if (value.expenseDate !== undefined) payload.expenseDate = new Date(value.expenseDate);
  if (value.storeId !== undefined) payload.storeId = value.storeId || null;
  return payload;
}

export const listExpenses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate, storeId, category, skip = 0, take = 200 } = req.query;
    const where: any = { businessId: bid(req), isActive: true };

    if (storeId) where.storeId = storeId as string;
    if (category) where.category = { contains: category as string, mode: 'insensitive' };
    if (startDate || endDate) {
      where.expenseDate = {};
      if (startDate) where.expenseDate.gte = new Date(startDate as string);
      if (endDate) {
        const inclusiveEnd = new Date(endDate as string);
        inclusiveEnd.setHours(23, 59, 59, 999);
        where.expenseDate.lte = inclusiveEnd;
      }
    }

    const parsedTake = parseInt(take as string) || 200;
    const parsedSkip = parseInt(skip as string) || 0;

    const [expenses, total, aggregate] = await Promise.all([
      prisma.expense.findMany({
        where,
        skip: parsedSkip,
        take: parsedTake,
        orderBy: { expenseDate: 'desc' },
        include: { store: { select: { id: true, name: true } } },
      }),
      prisma.expense.count({ where }),
      prisma.expense.aggregate({ where, _sum: { amount: true } }),
    ]);

    res.json({
      success: true,
      data: expenses,
      summary: { totalAmount: Number(aggregate._sum.amount || 0) },
      pagination: { total, skip: parsedSkip, take: parsedTake },
    });
  } catch (error) { next(error); }
};

export const createExpense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = expenseSchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    await assertStoreBelongsToBusiness(bid(req), value.storeId);
    const expense = await prisma.expense.create({
      data: {
        businessId: bid(req),
        ...normalizeExpensePayload(value, true),
      },
      include: { store: { select: { id: true, name: true } } },
    });

    logger.info(`Expense created: ${expense.category} ${expense.amount}`);
    res.status(201).json({ success: true, message: 'Expense created successfully', data: expense });
  } catch (error) { next(error); }
};

export const getExpense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const expense = await prisma.expense.findFirst({
      where: { id: req.params.id, businessId: bid(req), isActive: true },
      include: { store: { select: { id: true, name: true } } },
    });
    if (!expense) return next(new NotFoundError('Expense'));
    res.json({ success: true, data: expense });
  } catch (error) { next(error); }
};

export const updateExpense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = updateExpenseSchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    const existing = await prisma.expense.findFirst({
      where: { id: req.params.id, businessId: bid(req), isActive: true },
    });
    if (!existing) return next(new NotFoundError('Expense'));

    await assertStoreBelongsToBusiness(bid(req), value.storeId);
    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: normalizeExpensePayload(value),
      include: { store: { select: { id: true, name: true } } },
    });

    res.json({ success: true, message: 'Expense updated successfully', data: expense });
  } catch (error) { next(error); }
};

export const deactivateExpense = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.expense.findFirst({
      where: { id: req.params.id, businessId: bid(req), isActive: true },
    });
    if (!existing) return next(new NotFoundError('Expense'));

    const expense = await prisma.expense.update({
      where: { id: req.params.id },
      data: { isActive: false },
    });

    res.json({ success: true, message: 'Expense deleted successfully', data: expense });
  } catch (error) { next(error); }
};
