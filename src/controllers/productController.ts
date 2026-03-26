import { Request, Response, NextFunction } from 'express';
import { CustomerType } from '@prisma/client';
import Joi from 'joi';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { priceService } from '../services/priceService.js';
import { prisma } from '../utils/prisma.js';
import logger from '../utils/logger.js';

const createProductSchema = Joi.object({
  name: Joi.string().required(),
  description: Joi.string().allow('').optional(),
  barcode: Joi.string().allow('').optional(),
  categoryId: Joi.string().allow('').optional(),
  reorderPoint: Joi.number().integer().min(0).optional(),
  prices: Joi.array().optional(), // accepted but handled separately below
  isActive: Joi.boolean().optional(),
});

const updateProductSchema = Joi.object({
  name: Joi.string().optional(),
  description: Joi.string().allow('').optional(),
  barcode: Joi.string().allow('').optional(),
  categoryId: Joi.string().allow('').optional(),
  reorderPoint: Joi.number().integer().min(0).optional(),
  unitLevel: Joi.string().valid('CARTON', 'BLOCK', 'PIECE').optional(),
  parentId: Joi.number().integer().allow(null).optional(),
  conversionRate: Joi.number().integer().min(1).allow(null).optional(),
});

const createPriceSchema = Joi.object({
  customerType: Joi.string().valid('RETAIL', 'WHOLESALE').required(),
  unitPrice: Joi.number().positive().required(),
  costPrice: Joi.number().positive().required(),
  minQuantity: Joi.number().integer().min(1).optional(),
  discount: Joi.number().min(0).max(100).optional(),
});

const bid = (req: Request) => req.user!.businessId;

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = createProductSchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    if (value.barcode) {
      const existing = await prisma.product.findFirst({
        where: { businessId: bid(req), barcode: value.barcode },
      });
      if (existing) return next(new ValidationError('Barcode already exists'));
    }

    const product = await prisma.product.create({
      data: {
        businessId: bid(req),
        name: value.name,
        description: value.description || null,
        barcode: value.barcode || null,
        categoryId: value.categoryId || null,
        reorderPoint: value.reorderPoint ?? 10,
        ...(value.prices?.length ? {
          prices: {
            create: value.prices.map((p: any) => ({
              customerType: p.customerType,
              unitPrice: p.unitPrice,
              costPrice: p.costPrice ?? p.unitPrice,
              minQuantity: p.minQuantity ?? 1,
              discount: p.discount ?? 0,
            })),
          },
        } : {}),
      },
      include: { category: true, prices: true, stock: true },
    });

    logger.info(`Product created: ${product.id}`);
    res.status(201).json({ success: true, message: 'Product created successfully', data: product });
  } catch (error) { next(error); }
};

export const getProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const product = await prisma.product.findFirst({
      where: { id: parseInt(req.params.id), businessId: bid(req) },
      include: {
        category: true,
        stock: { where: { isActive: true }, orderBy: { receivedDate: 'asc' } },
        prices: { where: { isActive: true }, orderBy: { minQuantity: 'asc' } },
      },
    });

    if (!product) return next(new NotFoundError('Product'));
    res.json({ success: true, data: product });
  } catch (error) { next(error); }
};

export const listProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { categoryId, search, skip = 0, take = 50 } = req.query;

    const where: any = { businessId: bid(req), isActive: true };
    if (categoryId) where.categoryId = categoryId;
    if (search) {
      where.OR = [
        { name: { contains: search as string, mode: 'insensitive' } },
        { barcode: { contains: search as string, mode: 'insensitive' } },
      ];
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: true,
          stock: { where: { isActive: true }, select: { id: true, batchNumber: true, quantity: true, quantityUsed: true, expiryDate: true } },
          prices: { where: { isActive: true } },
        },
        skip: parseInt(skip as string) || 0,
        take: parseInt(take as string) || 50,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.product.count({ where }),
    ]);

    res.json({ success: true, data: products, pagination: { total, skip: parseInt(skip as string) || 0, take: parseInt(take as string) || 50 } });
  } catch (error) { next(error); }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = updateProductSchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    const existing = await prisma.product.findFirst({ where: { id: parseInt(req.params.id), businessId: bid(req) } });
    if (!existing) return next(new NotFoundError('Product'));

    if (value.barcode) {
      const barcodeConflict = await prisma.product.findFirst({
        where: { businessId: bid(req), barcode: value.barcode, id: { not: parseInt(req.params.id) } },
      });
      if (barcodeConflict) return next(new ValidationError('Barcode already exists'));
    }

    const product = await prisma.product.update({
      where: { id: parseInt(req.params.id) },
      data: value,
      include: { category: true, prices: true, stock: { where: { isActive: true } } },
    });

    logger.info(`Product updated: ${product.id}`);
    res.json({ success: true, message: 'Product updated successfully', data: product });
  } catch (error) { next(error); }
};

export const setProductPrice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = createPriceSchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    const product = await prisma.product.findFirst({ where: { id: parseInt(req.params.id), businessId: bid(req) } });
    if (!product) return next(new NotFoundError('Product'));

    const price = await priceService.createPrice(
      req.params.id,
      value.customerType as CustomerType,
      value.unitPrice,
      value.costPrice,
      value.minQuantity || 1,
      value.discount || 0
    );

    logger.info(`Price set for product ${req.params.id}`);
    res.json({ success: true, message: 'Price set successfully', data: price });
  } catch (error) { next(error); }
};
