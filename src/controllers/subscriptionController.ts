import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { subscriptionService } from '../services/subscriptionService.js';

const bid = (req: Request) => req.user!.businessId;

export const getCurrent = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sub = await subscriptionService.getCurrent(bid(req));
    res.json({ success: true, data: sub });
  } catch (err) { next(err); }
};

export const changePlan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = Joi.object({
      plan: Joi.string().valid('STARTER', 'BUSINESS', 'ENTERPRISE').required(),
      billingCycle: Joi.string().valid('monthly', 'annual').default('monthly'),
      currency: Joi.string().max(5).default('KES'),
      notes: Joi.string().optional(),
    }).validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.message });
    const sub = await subscriptionService.changePlan(bid(req), value.plan, value.billingCycle, value.currency, value.notes);
    res.json({ success: true, data: sub });
  } catch (err) { next(err); }
};

export const recordPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = Joi.object({
      amount: Joi.number().positive().required(),
      currency: Joi.string().max(5).default('KES'),
      paymentMethod: Joi.string().valid('MPESA', 'MTN_MOMO', 'TIGO_PESA', 'CARD', 'BANK_TRANSFER', 'CASH').required(),
      reference: Joi.string().optional(),
      periodStart: Joi.date().required(),
      periodEnd: Joi.date().greater(Joi.ref('periodStart')).required(),
      notes: Joi.string().optional(),
    }).validate(req.body);
    if (error) return res.status(400).json({ success: false, message: error.message });
    const sub = await subscriptionService.getCurrent(bid(req));
    const payment = await subscriptionService.recordPayment(
      sub.id, value.amount, value.currency, value.paymentMethod,
      value.reference, new Date(value.periodStart), new Date(value.periodEnd), value.notes,
    );
    res.status(201).json({ success: true, data: payment });
  } catch (err) { next(err); }
};

export const confirmPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await subscriptionService.confirmPayment(req.params.paymentId, req.user!.userId, req.body.notes);
    res.json({ success: true, data: payment });
  } catch (err) { next(err); }
};

export const failPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await subscriptionService.failPayment(req.params.paymentId, req.body.notes);
    res.json({ success: true, data: payment });
  } catch (err) { next(err); }
};

export const refundPayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await subscriptionService.refundPayment(req.params.paymentId, req.body.notes);
    res.json({ success: true, data: payment });
  } catch (err) { next(err); }
};

export const getPaymentHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payments = await subscriptionService.getPaymentHistory(bid(req));
    res.json({ success: true, data: payments });
  } catch (err) { next(err); }
};

export const suspend = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sub = await subscriptionService.suspend(bid(req), req.body.notes);
    res.json({ success: true, data: sub });
  } catch (err) { next(err); }
};

export const reinstate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sub = await subscriptionService.reinstate(bid(req));
    res.json({ success: true, data: sub });
  } catch (err) { next(err); }
};

export const cancel = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sub = await subscriptionService.cancel(bid(req), req.body.notes);
    res.json({ success: true, data: sub });
  } catch (err) { next(err); }
};
