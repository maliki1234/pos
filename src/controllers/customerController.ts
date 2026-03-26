import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError, NotFoundError, ConflictError } from '../utils/errors.js';
import { prisma } from '../utils/prisma.js';
import logger from '../utils/logger.js';

const createCustomerSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().optional().allow('', null),
  phone: Joi.string().optional().allow('', null),
  customerType: Joi.string().valid('RETAIL', 'WHOLESALE').optional(),
  creditLimit: Joi.number().min(0).optional().allow(null),
});

const updateCustomerSchema = Joi.object({
  name: Joi.string().optional(),
  email: Joi.string().email().optional().allow('', null),
  phone: Joi.string().optional().allow('', null),
  customerType: Joi.string().valid('RETAIL', 'WHOLESALE').optional(),
  creditLimit: Joi.number().min(0).optional().allow(null),
});

const bid = (req: Request) => req.user!.businessId;

export const createCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = createCustomerSchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    if (value.email) {
      const existing = await prisma.customer.findFirst({ where: { businessId: bid(req), email: value.email } });
      if (existing) return next(new ConflictError('Email already registered'));
    }

    const customer = await prisma.customer.create({
      data: {
        businessId: bid(req),
        name: value.name,
        email: value.email || null,
        phone: value.phone || null,
        customerType: value.customerType || 'RETAIL',
        ...(value.creditLimit != null && { creditLimit: value.creditLimit }),
      },
    });

    logger.info(`Customer created: ${customer.name}`);
    res.status(201).json({ success: true, message: 'Customer created successfully', data: customer });
  } catch (error) { next(error); }
};

export const getCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: req.params.id, businessId: bid(req) },
    });
    if (!customer) return next(new NotFoundError('Customer'));
    res.json({ success: true, data: customer });
  } catch (error) { next(error); }
};

export const listCustomers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerType, search, skip = 0, take = 200 } = req.query;

    const where: any = { businessId: bid(req), isActive: true };
    if (customerType) where.customerType = customerType;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { email: { contains: search as string, mode: 'insensitive' } },
        { phone: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip: parseInt(skip as string) || 0,
        take: parseInt(take as string) || 200,
        orderBy: { createdAt: 'desc' },
        include: { loyaltyAccount: { select: { tier: true, totalPoints: true } } },
      }),
      prisma.customer.count({ where }),
    ]);

    res.json({ success: true, data: customers, pagination: { total, skip, take: parseInt(take as string) || 200 } });
  } catch (error) { next(error); }
};

export const updateCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = updateCustomerSchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    const existing = await prisma.customer.findFirst({ where: { id: req.params.id, businessId: bid(req) } });
    if (!existing) return next(new NotFoundError('Customer'));

    const customer = await prisma.customer.update({ where: { id: req.params.id }, data: value });
    logger.info(`Customer updated: ${customer.name}`);
    res.json({ success: true, message: 'Customer updated successfully', data: customer });
  } catch (error) { next(error); }
};

export const deactivateCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await prisma.customer.findFirst({ where: { id: req.params.id, businessId: bid(req) } });
    if (!existing) return next(new NotFoundError('Customer'));

    const customer = await prisma.customer.update({ where: { id: req.params.id }, data: { isActive: false } });
    logger.info(`Customer deactivated: ${customer.name}`);
    res.json({ success: true, message: 'Customer deactivated successfully', data: customer });
  } catch (error) { next(error); }
};
