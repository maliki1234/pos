import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError } from '../utils/errors.js';
import { creditService } from '../services/creditService.js';
import logger from '../utils/logger.js';

const repaymentSchema = Joi.object({
  amount: Joi.number().positive().required(),
  paymentMethod: Joi.string()
    .valid('CASH', 'CARD', 'CHEQUE', 'BANK_TRANSFER', 'MOBILE_MONEY')
    .default('CASH'),
  notes: Joi.string().optional(),
});

const bid = (req: Request) => req.user!.businessId;

export const getCustomerLedger = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await creditService.getCustomerLedger(bid(req), req.params.customerId);
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

export const getLedgerEntry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const entry = await creditService.getLedgerEntry(bid(req), req.params.id);
    res.json({ success: true, data: entry });
  } catch (error) { next(error); }
};

export const recordRepayment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = repaymentSchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    const result = await creditService.recordRepayment(
      bid(req),
      req.params.ledgerId,
      value.amount,
      value.paymentMethod,
      req.user!.userId,
      value.notes
    );

    logger.info(`Repayment recorded on ledger ${req.params.ledgerId} by ${req.user!.email}`);
    res.json({ success: true, message: 'Repayment recorded', data: result });
  } catch (error) { next(error); }
};

export const searchAllCredit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const entries = await creditService.searchAllCredit(bid(req), q);
    res.json({ success: true, data: entries });
  } catch (error) { next(error); }
};

export const getCustomerCreditSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await creditService.getCustomerCreditSummary(bid(req), req.params.customerId);
    res.json({ success: true, data: summary });
  } catch (error) { next(error); }
};

export const getAgingReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await creditService.markOverdue(bid(req));
    const report = await creditService.getAgingReport(bid(req));
    res.json({ success: true, data: report });
  } catch (error) { next(error); }
};
