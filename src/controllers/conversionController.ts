import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { prisma } from '../utils/prisma.js';
import { ValidationError, NotFoundError } from '../utils/errors.js';
import { stockService } from '../services/stockService.js';

const bid = (req: Request) => req.user!.businessId;

const convertSchema = Joi.object({
  fromProductId: Joi.number().integer().required(),
  toProductId:   Joi.number().integer().required(),
  storeId:       Joi.string().uuid().optional(),
  quantityIn:    Joi.number().integer().min(1).required(),
  notes:         Joi.string().allow('').optional(),
});

const simulateSchema = Joi.object({
  fromProductId: Joi.number().integer().required(),
  storeId: Joi.string().uuid().optional(),
  scenarios: Joi.array().items(Joi.object({
    piecesCount:  Joi.number().integer().min(1).required(),
    sellingPrice: Joi.number().positive().required(),
  })).min(1).required(),
});

// ── List conversion history ───────────────────────────────────────────────────
export const listConversions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await prisma.stockConversion.findMany({
      where: { businessId: bid(req) },
      include: {
        fromProduct: { select: { id: true, name: true, unitLevel: true } },
        toProduct:   { select: { id: true, name: true, unitLevel: true } },
      },
      orderBy: { convertedAt: 'desc' },
      take: 200,
    });
    res.json({ success: true, data: rows });
  } catch (e) { next(e); }
};

// ── Execute conversion ────────────────────────────────────────────────────────
export const convertStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = convertSchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));
    const storeId = await stockService.resolveStoreId(bid(req), value.storeId);

    // Load parent product with its stock
    const fromProduct = await prisma.product.findFirst({
      where: { id: value.fromProductId, businessId: bid(req), storeId },
      include: { stock: { where: { isActive: true, storeId }, orderBy: { receivedDate: 'asc' } } },
    });
    if (!fromProduct) return next(new NotFoundError('Source product not found'));

    // Load child product
    const toProduct = await prisma.product.findFirst({
      where: { id: value.toProductId, businessId: bid(req), storeId },
    });
    if (!toProduct) return next(new NotFoundError('Target product not found'));

    // Validate hierarchy
    if (toProduct.parentId !== value.fromProductId) {
      return next(new ValidationError(
        `"${toProduct.name}" is not a child of "${fromProduct.name}". Set the parent relationship first.`
      ));
    }
    if (!toProduct.conversionRate || toProduct.conversionRate <= 0) {
      return next(new ValidationError(
        `"${toProduct.name}" has no conversion rate. Set how many ${toProduct.name}s are in one ${fromProduct.name}.`
      ));
    }

    // Check available parent stock
    const totalAvailable = fromProduct.stock.reduce(
      (sum: number, b: any) => sum + (b.quantity - b.quantityUsed), 0
    );
    if (totalAvailable < value.quantityIn) {
      return next(new ValidationError(
        `Insufficient stock: need ${value.quantityIn} ${fromProduct.name}, only ${totalAvailable} available`
      ));
    }

    const quantityOut = value.quantityIn * toProduct.conversionRate;

    // Atomic: deduct parent FIFO + create child stock + update cost price + record
    const record = await prisma.$transaction(async (tx) => {
      // Deduct parent stock FIFO
      let remaining = value.quantityIn;
      let totalCost = 0;

      for (const batch of fromProduct.stock) {
        if (remaining <= 0) break;
        const avail = batch.quantity - (batch.quantityUsed as number);
        if (avail <= 0) continue;
        const using = Math.min(avail, remaining);
        await tx.stockBatch.update({
          where: { id: batch.id },
          data:  { quantityUsed: { increment: using } },
        });
        totalCost += using * Number(batch.unitCost);
        remaining -= using;
      }

      const costPerParentUnit = totalCost / value.quantityIn;
      const childCostPerUnit  = costPerParentUnit / toProduct.conversionRate!;

      // Add child stock batch
      const lastBatch = await tx.stockBatch.findFirst({
        where: { productId: value.toProductId, storeId },
        orderBy: { batchNumber: 'desc' },
      });
      await tx.stockBatch.create({
        data: {
          productId:    value.toProductId,
          storeId,
          batchNumber:  (lastBatch?.batchNumber ?? 0) + 1,
          quantity:     quantityOut,
          quantityUsed: 0,
          unitCost:     childCostPerUnit,
          notes: `Converted from ${fromProduct.name} (${value.quantityIn} units)${value.notes ? ' — ' + value.notes : ''}`,
        },
      });

      // Record conversion
      return tx.stockConversion.create({
        data: {
          businessId:    bid(req),
          fromProductId: value.fromProductId,
          toProductId:   value.toProductId,
          quantityIn:    value.quantityIn,
          quantityOut,
          costPerUnit:   childCostPerUnit.toString(),
          notes:         value.notes || null,
        },
      });
    });

    res.status(201).json({
      success: true,
      data: {
        record,
        summary: {
          fromProduct: fromProduct.name,
          toProduct:   toProduct.name,
          quantityIn:  value.quantityIn,
          quantityOut,
          costPerUnit: record.costPerUnit,
        },
      },
    });
  } catch (e) { next(e); }
};

// ── Simulate pricing ──────────────────────────────────────────────────────────
export const simulateConversion = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = simulateSchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));
    const storeId = await stockService.resolveStoreId(bid(req), value.storeId);

    const fromProduct = await prisma.product.findFirst({
      where: { id: value.fromProductId, businessId: bid(req), storeId },
      include: { stock: { where: { isActive: true, storeId } } },
    });
    if (!fromProduct) return next(new NotFoundError('Product not found'));

    // Weighted average cost from current stock
    const totalUnits = fromProduct.stock.reduce(
      (s: number, b: any) => s + Math.max(0, b.quantity - b.quantityUsed), 0
    );
    const totalValue = fromProduct.stock.reduce(
      (s: number, b: any) => s + Math.max(0, b.quantity - b.quantityUsed) * Number(b.unitCost), 0
    );
    const avgCost = totalUnits > 0 ? totalValue / totalUnits : 0;

    const scenarios = value.scenarios.map((s: any) => {
      const costPerPiece    = s.piecesCount > 0 ? avgCost / s.piecesCount : 0;
      const revenuePerUnit  = s.sellingPrice * s.piecesCount;
      const profitPerUnit   = revenuePerUnit - avgCost;
      const marginPct       = revenuePerUnit > 0 ? (profitPerUnit / revenuePerUnit) * 100 : 0;
      return {
        piecesCount:   s.piecesCount,
        sellingPrice:  s.sellingPrice,
        costPerPiece:  Math.round(costPerPiece * 100) / 100,
        revenuePerUnit: Math.round(revenuePerUnit * 100) / 100,
        profitPerUnit:  Math.round(profitPerUnit * 100) / 100,
        marginPct:     Math.round(marginPct * 10) / 10,
      };
    });

    res.json({
      success: true,
      data: {
        product: { id: fromProduct.id, name: fromProduct.name, unitLevel: fromProduct.unitLevel, avgCostPerUnit: Math.round(avgCost * 100) / 100, totalAvailable: totalUnits },
        scenarios,
      },
    });
  } catch (e) { next(e); }
};
