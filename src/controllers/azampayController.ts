import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import {
  initiateAzampayCheckout,
  registerAzampayPending,
  resolveAzampayCallback,
} from '../services/azampayService.js';

const checkoutSchema = Joi.object({
  phone:      Joi.string().required(),
  amount:     Joi.number().positive().required(),
  externalId: Joi.string().required(),
});

// POST /payments/azampay/checkout  (authenticated)
export const checkout = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = checkoutSchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    const result = await initiateAzampayCheckout(
      req.user!.businessId,
      value.phone,
      value.amount,
      value.externalId,
    );

    res.json({ success: true, data: result });
  } catch (e: any) {
    next(new ValidationError(e.message));
  }
};

// POST /payments/azampay/callback  (NO auth — Azampay calls this)
export const callback = (req: Request, res: Response) => {
  try {
    const body = req.body;
    logger.info(`Azampay callback received: ${JSON.stringify(body)}`);

    // Azampay callback fields: utilityref, reference, msisdn, amount, operator, message, type
    const externalId = body.utilityref as string;
    const reference  = (body.reference || body.utilityref) as string;
    const success    = body.type === 'payment' || String(body.message || '').toLowerCase().includes('success');

    if (externalId) {
      resolveAzampayCallback(externalId, success, reference);
    }
  } catch (e) {
    logger.error('Azampay callback error', e);
  }
  // Always return 200 to Azampay
  res.json({ message: 'OK' });
};
