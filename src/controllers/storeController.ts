import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError } from '../utils/errors.js';
import { storeService } from '../services/storeService.js';
import logger from '../utils/logger.js';

const createStoreSchema = Joi.object({
  name:    Joi.string().required(),
  address: Joi.string().optional().allow(''),
  phone:   Joi.string().optional().allow(''),
});

const updateStoreSchema = Joi.object({
  name:      Joi.string().optional(),
  address:   Joi.string().optional().allow(''),
  phone:     Joi.string().optional().allow(''),
  isDefault: Joi.boolean().optional(),
});

const assignUserSchema = Joi.object({
  userId:  Joi.string().uuid().required(),
  storeId: Joi.string().uuid().allow(null).optional(),
});

export const listStores = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stores = await storeService.listStores(req.user!.businessId);
    res.json({ success: true, data: stores });
  } catch (error) { next(error); }
};

export const getStore = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const store = await storeService.getStore(req.user!.businessId, req.params.storeId);
    res.json({ success: true, data: store });
  } catch (error) { next(error); }
};

export const createStore = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = createStoreSchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    const store = await storeService.createStore(req.user!.businessId, value);
    logger.info(`Store created: ${store.name} for business ${req.user!.businessId}`);
    res.status(201).json({ success: true, message: 'Store created successfully', data: store });
  } catch (error) { next(error); }
};

export const updateStore = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = updateStoreSchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    const store = await storeService.updateStore(req.user!.businessId, req.params.storeId, value);
    res.json({ success: true, message: 'Store updated', data: store });
  } catch (error) { next(error); }
};

export const deactivateStore = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await storeService.deactivateStore(req.user!.businessId, req.params.storeId);
    res.json({ success: true, message: 'Store deactivated' });
  } catch (error) { next(error); }
};

export const assignUserToStore = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = assignUserSchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    const user = await storeService.assignUserToStore(
      req.user!.businessId,
      value.userId,
      value.storeId ?? null
    );
    res.json({ success: true, message: 'User assigned to store', data: user });
  } catch (error) { next(error); }
};
