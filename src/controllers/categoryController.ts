import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import Joi from 'joi';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import logger from '../utils/logger.js';

const prisma = new PrismaClient();

const createCategorySchema = Joi.object({
  name: Joi.string().required().trim(),
  description: Joi.string().allow('').optional().trim(),
  isActive: Joi.boolean().optional(),
});

const updateCategorySchema = Joi.object({
  name: Joi.string().optional().trim(),
  description: Joi.string().allow('').optional().trim(),
  isActive: Joi.boolean().optional(),
});

export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = createCategorySchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    const businessId = req.user!.businessId;

    const existing = await prisma.category.findUnique({
      where: { businessId_name: { businessId, name: value.name } },
    });
    if (existing) return next(new ValidationError('Category name already exists'));

    const category = await prisma.category.create({
      data: { name: value.name, description: value.description, businessId },
    });

    logger.info(`Category created: ${category.name}`);
    res.status(201).json({ success: true, message: 'Category created successfully', data: category });
  } catch (error) {
    next(error);
  }
};

export const getCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.user!.businessId;
    const category = await prisma.category.findFirst({
      where: { id: req.params.id, businessId },
      include: { products: { where: { isActive: true } } },
    });
    if (!category) return next(new NotFoundError('Category'));
    res.json({ success: true, data: category });
  } catch (error) {
    next(error);
  }
};

export const listCategories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.user!.businessId;
    const { skip = 0, take = 50 } = req.query;

    const [categories, total] = await Promise.all([
      prisma.category.findMany({
        where: { businessId, isActive: true },
        include: { products: { where: { isActive: true } } },
        skip: parseInt(skip as string) || 0,
        take: parseInt(take as string) || 50,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.category.count({ where: { businessId, isActive: true } }),
    ]);

    res.json({ success: true, data: categories, pagination: { total, skip: parseInt(skip as string) || 0, take: parseInt(take as string) || 50 } });
  } catch (error) {
    next(error);
  }
};

export const updateCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = updateCategorySchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    const businessId = req.user!.businessId;

    const existing = await prisma.category.findFirst({ where: { id: req.params.id, businessId } });
    if (!existing) return next(new NotFoundError('Category'));

    if (value.name && value.name !== existing.name) {
      const duplicate = await prisma.category.findUnique({
        where: { businessId_name: { businessId, name: value.name } },
      });
      if (duplicate) return next(new ValidationError('Category name already exists'));
    }

    const category = await prisma.category.update({
      where: { id: req.params.id },
      data: {
        ...(value.name && { name: value.name }),
        ...(value.description !== undefined && { description: value.description }),
      },
    });

    logger.info(`Category updated: ${category.name}`);
    res.json({ success: true, message: 'Category updated successfully', data: category });
  } catch (error) {
    next(error);
  }
};

export const deleteCategory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const businessId = req.user!.businessId;

    const category = await prisma.category.findFirst({ where: { id: req.params.id, businessId } });
    if (!category) return next(new NotFoundError('Category'));

    const productsCount = await prisma.product.count({ where: { categoryId: req.params.id, businessId } });
    if (productsCount > 0) return next(new ValidationError('Cannot delete category with associated products'));

    await prisma.category.delete({ where: { id: req.params.id } });

    logger.info(`Category deleted: ${category.name}`);
    res.json({ success: true, message: 'Category deleted successfully' });
  } catch (error) {
    next(error);
  }
};
