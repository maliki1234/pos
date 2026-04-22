import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { prisma } from '../utils/prisma.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';

const bid = (req: Request) => req.user!.businessId;

const ingredientSchema = Joi.object({
  productId: Joi.number().integer().required(),
  quantity: Joi.number().positive().required(),
  unit: Joi.string().default('units'),
});

const recipeSchema = Joi.object({
  productId: Joi.number().integer().required(),
  name: Joi.string().required(),
  yieldQty: Joi.number().integer().min(1).default(1),
  notes: Joi.string().allow('').optional(),
  ingredients: Joi.array().items(ingredientSchema).min(1).required(),
});

const productionSchema = Joi.object({
  recipeId: Joi.string().required(),
  quantityProduced: Joi.number().integer().min(1).required(),
  extraCosts: Joi.array().items(Joi.object({
    name: Joi.string().required(),
    amount: Joi.number().min(0).required(),
  })).optional().default([]),
  notes: Joi.string().allow('').optional(),
});

// ── List recipes ──────────────────────────────────────────────────────────────
export const listRecipes = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const recipes = await prisma.recipe.findMany({
      where: { businessId: bid(req), isActive: true },
      include: {
        product: { select: { id: true, name: true } },
        ingredients: {
          include: { product: { select: { id: true, name: true } } },
        },
        _count: { select: { runs: true } },
      },
      orderBy: { name: 'asc' },
    });
    res.json({ success: true, data: recipes });
  } catch (e) { next(e); }
};

// ── Create recipe ─────────────────────────────────────────────────────────────
export const createRecipe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = recipeSchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    const existing = await prisma.recipe.findFirst({
      where: { businessId: bid(req), name: value.name },
    });
    if (existing) return next(new ValidationError('A recipe with this name already exists'));

    const recipe = await prisma.recipe.create({
      data: {
        businessId: bid(req),
        productId: value.productId,
        name: value.name,
        yieldQty: value.yieldQty,
        notes: value.notes || null,
        ingredients: {
          create: value.ingredients.map((i: any) => ({
            productId: i.productId,
            quantity: i.quantity,
            unit: i.unit,
          })),
        },
      },
      include: {
        product: { select: { id: true, name: true } },
        ingredients: { include: { product: { select: { id: true, name: true } } } },
      },
    });

    res.status(201).json({ success: true, data: recipe });
  } catch (e) { next(e); }
};

// ── Update recipe ─────────────────────────────────────────────────────────────
export const updateRecipe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const recipe = await prisma.recipe.findFirst({ where: { id, businessId: bid(req) } });
    if (!recipe) return next(new NotFoundError('Recipe not found'));

    const { error, value } = recipeSchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    // Replace ingredients
    await prisma.recipeIngredient.deleteMany({ where: { recipeId: id } });

    const updated = await prisma.recipe.update({
      where: { id },
      data: {
        productId: value.productId,
        name: value.name,
        yieldQty: value.yieldQty,
        notes: value.notes || null,
        ingredients: {
          create: value.ingredients.map((i: any) => ({
            productId: i.productId,
            quantity: i.quantity,
            unit: i.unit,
          })),
        },
      },
      include: {
        product: { select: { id: true, name: true } },
        ingredients: { include: { product: { select: { id: true, name: true } } } },
      },
    });

    res.json({ success: true, data: updated });
  } catch (e) { next(e); }
};

// ── Delete recipe ─────────────────────────────────────────────────────────────
export const deleteRecipe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const recipe = await prisma.recipe.findFirst({ where: { id, businessId: bid(req) } });
    if (!recipe) return next(new NotFoundError('Recipe not found'));

    await prisma.recipe.update({ where: { id }, data: { isActive: false } });
    res.json({ success: true, message: 'Recipe deleted' });
  } catch (e) { next(e); }
};

// ── Run production ────────────────────────────────────────────────────────────
export const runProduction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = productionSchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    const recipe = await prisma.recipe.findFirst({
      where: { id: value.recipeId, businessId: bid(req), isActive: true },
      include: {
        ingredients: { include: { product: { include: { stock: { where: { isActive: true }, orderBy: { receivedDate: 'asc' } } } } } },
        product: true,
      },
    });
    if (!recipe) return next(new NotFoundError('Recipe not found'));

    const batchesNeeded = value.quantityProduced / recipe.yieldQty;

    // ── Validate stock availability ──────────────────────────────────────────
    for (const ing of recipe.ingredients) {
      const needed = Number(ing.quantity) * batchesNeeded;
      const available = ing.product.stock.reduce(
        (sum: number, b: any) => sum + (b.quantity - b.quantityUsed), 0
      );
      if (available < needed) {
        return next(new ValidationError(
          `Insufficient stock for "${ing.product.name}": need ${needed}, have ${available} ${ing.unit}`
        ));
      }
    }

    // ── Deduct ingredients (FIFO) + calculate material cost ──────────────────
    let totalMaterialCost = 0;

    for (const ing of recipe.ingredients) {
      let toDeduct = Number(ing.quantity) * batchesNeeded;

      for (const batch of ing.product.stock) {
        if (toDeduct <= 0) break;
        const available = batch.quantity - batch.quantityUsed;
        if (available <= 0) continue;

        const deducting = Math.min(available, toDeduct);
        await prisma.stockBatch.update({
          where: { id: batch.id },
          data: { quantityUsed: { increment: deducting } },
        });

        totalMaterialCost += deducting * Number(batch.unitCost);
        toDeduct -= deducting;
      }
    }

    // ── Extra costs ───────────────────────────────────────────────────────────
    const totalExtraCost = (value.extraCosts as any[]).reduce(
      (sum: number, c: any) => sum + Number(c.amount), 0
    );

    const totalCost = totalMaterialCost + totalExtraCost;
    const costPerUnit = value.quantityProduced > 0 ? totalCost / value.quantityProduced : 0;

    // ── Add finished product stock ────────────────────────────────────────────
    const lastBatch = await prisma.stockBatch.findFirst({
      where: { productId: recipe.productId },
      orderBy: { batchNumber: 'desc' },
    });
    const nextBatch = (lastBatch?.batchNumber ?? 0) + 1;

    await prisma.stockBatch.create({
      data: {
        productId: recipe.productId,
        batchNumber: nextBatch,
        quantity: value.quantityProduced,
        quantityUsed: 0,
        unitCost: costPerUnit,
        notes: `Production run — ${recipe.name}${value.notes ? ': ' + value.notes : ''}`,
      },
    });

    // ── Record production run ────────────────────────────────────────────────
    const run = await prisma.productionRun.create({
      data: {
        businessId: bid(req),
        recipeId: value.recipeId,
        quantityProduced: value.quantityProduced,
        extraCosts: value.extraCosts,
        totalMaterialCost,
        totalExtraCost,
        costPerUnit,
        notes: value.notes || null,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        run,
        summary: {
          quantityProduced: value.quantityProduced,
          totalMaterialCost,
          totalExtraCost,
          totalCost,
          costPerUnit,
        },
      },
    });
  } catch (e) { next(e); }
};

// ── Production history ────────────────────────────────────────────────────────
export const listProductionRuns = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const runs = await prisma.productionRun.findMany({
      where: { businessId: bid(req) },
      include: { recipe: { select: { name: true, product: { select: { name: true } } } } },
      orderBy: { producedAt: 'desc' },
      take: 100,
    });
    res.json({ success: true, data: runs });
  } catch (e) { next(e); }
};
