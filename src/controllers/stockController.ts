import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError } from '../utils/errors.js';
import { stockService } from '../services/stockService.js';
import logger from '../utils/logger.js';

const addStockBatchSchema = Joi.object({
  productId: Joi.number().required(),
  storeId: Joi.string().uuid().optional(),
  quantity: Joi.number().integer().positive().required(),
  unitCost: Joi.number().positive().required(),
  expiryDate: Joi.date().optional(),
  notes: Joi.string().allow('').optional(),
  isActive: Joi.boolean().optional(),
  receivedDate: Joi.date().optional(),
  batchNumber: Joi.string().allow('').optional(),
});

const updateBatchSchema = Joi.object({
  quantityUsed: Joi.number().integer().min(0).required(),
});

export const getStockBatches = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productId, storeId } = req.query;
    const selectedStoreId = typeof storeId === 'string' && storeId ? storeId : undefined;

    if (!productId) {
      const batches = await stockService.getAllStockBatches(req.user!.businessId, selectedStoreId);
      return res.json({
        success: true,
        data: batches,
      });
    }

    const batches = await stockService.getStockBatches(req.user!.businessId, Number(productId), selectedStoreId);

    res.json({
      success: true,
      data: batches,
    });
  } catch (error) {
    next(error);
  }
};

export const addStockBatch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = addStockBatchSchema.validate(req.body);

    if (error) {
      return next(new ValidationError(error.details[0].message));
    }

    const batch = await stockService.addStockBatch(
      req.user!.businessId,
      value.productId,
      value.storeId,
      value.quantity,
      value.unitCost,
      value.expiryDate ? new Date(value.expiryDate) : undefined,
      value.notes
    );

    logger.info(`Stock batch added: Product ${value.productId}, Batch ${batch.batchNumber}`);

    res.status(201).json({
      success: true,
      message: 'Stock batch added successfully',
      data: batch,
    });
  } catch (error) {
    next(error);
  }
};

export const getTotalQuantity = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productId, storeId } = req.query;

    if (!productId) {
      return next(new ValidationError('productId query parameter is required'));
    }

    const selectedStoreId = await stockService.resolveStoreId(
      req.user!.businessId,
      typeof storeId === 'string' && storeId ? storeId : undefined
    );
    const totalQuantity = await stockService.getTotalQuantity(Number(productId), selectedStoreId);

    res.json({
      success: true,
      data: { totalQuantity },
    });
  } catch (error) {
    next(error);
  }
};

export const deductStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productId, quantity, storeId } = req.body;

    if (!productId || quantity === undefined) {
      return next(new ValidationError('productId and quantity are required'));
    }

    if (typeof quantity !== 'number' || quantity <= 0) {
      return next(new ValidationError('quantity must be a positive number'));
    }

    const selectedStoreId = await stockService.resolveStoreId(req.user!.businessId, storeId);
    const usedBatches = await stockService.deductStockFIFO(productId, selectedStoreId, quantity);

    logger.info(`Stock deducted (FIFO): Product ${productId}, Qty ${quantity}`);

    res.json({
      success: true,
      message: 'Stock deducted successfully using FIFO algorithm',
      data: {
        productId,
        quantityDeducted: quantity,
        batchesUsed: usedBatches,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateBatchQuantityUsed = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { error, value } = updateBatchSchema.validate(req.body);

    if (error) {
      return next(new ValidationError(error.details[0].message));
    }

    const updated = await stockService.updateBatchQuantity(
      req.user!.businessId,
      req.params.batchId,
      value.quantityUsed
    );

    logger.info(`Batch ${updated.batchNumber} quantity updated`);

    res.json({
      success: true,
      message: 'Batch quantity updated successfully',
      data: updated,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteStockBatch = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const deleted = await stockService.deactivateStockBatch(
      req.user!.businessId,
      req.params.batchId
    );

    logger.info(`Batch ${deleted.batchNumber} deleted`);

    res.json({
      success: true,
      message: 'Stock batch deleted successfully',
      data: deleted,
    });
  } catch (error) {
    next(error);
  }
};

export const getLowStockProducts = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const storeId = typeof req.query.storeId === 'string' && req.query.storeId ? req.query.storeId : undefined;
    const lowStockProducts = await stockService.getLowStockProducts(req.user!.businessId, storeId);
    res.json({ success: true, data: lowStockProducts });
  } catch (error) {
    next(error);
  }
};

export const setReorderPoint = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = Joi.object({ reorderPoint: Joi.number().integer().min(0).required() });
    const { error, value } = schema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    const product = await stockService.setReorderPoint(
      req.user!.businessId,
      parseInt(req.params.productId),
      value.reorderPoint
    );
    res.json({ success: true, message: 'Reorder point updated', data: product });
  } catch (error) {
    next(error);
  }
};

export const getExpiredStockBatches = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const storeId = typeof req.query.storeId === 'string' && req.query.storeId ? req.query.storeId : undefined;
    const expiredBatches = await stockService.getExpiredStockBatches(req.user!.businessId, storeId);

    res.json({
      success: true,
      data: expiredBatches,
    });
  } catch (error) {
    next(error);
  }
};
