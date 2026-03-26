import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError } from '../utils/errors.js';
import { initiateStkPush, queryStkStatus, resolveCallback } from '../services/mpesaService.js';
import logger from '../utils/logger.js';

const stkSchema = Joi.object({
  phone:     Joi.string().required(),
  amount:    Joi.number().positive().required(),
  reference: Joi.string().optional().default('POS'),
});

/** POST /payments/mpesa/stk-push */
export const stkPush = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = stkSchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    const result = await initiateStkPush(req.user!.businessId, value.phone, value.amount, value.reference);
    res.json({ success: true, data: result });
  } catch (err: any) {
    next(new ValidationError(err.message));
  }
};

/** GET /payments/mpesa/status/:checkoutRequestId */
export const stkStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = await queryStkStatus(req.user!.businessId, req.params.checkoutRequestId);
    res.json({ success: true, data: status });
  } catch (err: any) {
    next(new ValidationError(err.message));
  }
};

/** POST /payments/mpesa/callback — Safaricom calls this (no auth) */
export const stkCallback = async (req: Request, res: Response) => {
  try {
    const body = req.body?.Body?.stkCallback;
    if (!body) { res.json({ ResultCode: 0, ResultDesc: 'Accepted' }); return; }

    const { CheckoutRequestID, ResultCode, CallbackMetadata } = body;
    const meta: any[] = CallbackMetadata?.Item ?? [];
    const mpesaReceiptNumber = meta.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value ?? CheckoutRequestID;

    logger.info(`M-Pesa callback: ${CheckoutRequestID} ResultCode=${ResultCode}`);
    resolveCallback(CheckoutRequestID, ResultCode, mpesaReceiptNumber);

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    logger.error('M-Pesa callback error', err);
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' }); // Always respond 200 to Safaricom
  }
};
