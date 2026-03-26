import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError } from '../utils/errors.js';
import { loyaltyService } from '../services/loyaltyService.js';

const redeemSchema = Joi.object({
  customerId: Joi.string().required(),
  points: Joi.number().integer().positive().required(),
});

const adjustSchema = Joi.object({
  customerId: Joi.string().required(),
  points: Joi.number().integer().required(),
  reason: Joi.string().min(3).required(),
});

const bid = (req: Request) => req.user!.businessId;

export const getCustomerLoyalty = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const account = await loyaltyService.getAccount(bid(req), req.params.customerId);
    res.json({ success: true, data: account });
  } catch (error) { next(error); }
};

export const redeemAtCheckout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = redeemSchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    const account = await loyaltyService.getAccount(bid(req), value.customerId);
    if (!account || account.totalPoints < value.points) {
      return next(new ValidationError('Insufficient loyalty points'));
    }

    const kesValue = value.points * 1;
    res.json({
      success: true,
      data: { points: value.points, kesValue, remainingPoints: account.totalPoints - value.points },
    });
  } catch (error) { next(error); }
};

export const adjustPoints = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = adjustSchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    const result = await loyaltyService.adjustPoints(
      bid(req),
      value.customerId,
      value.points,
      value.reason,
      req.user!.userId
    );
    res.json({ success: true, message: 'Points adjusted', data: result });
  } catch (error) { next(error); }
};
