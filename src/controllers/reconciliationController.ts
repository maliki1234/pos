import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError } from '../utils/errors.js';
import { reconciliationService } from '../services/reconciliationService.js';

const submitSchema = Joi.object({
  date: Joi.string().required(),
  actualCash: Joi.number().min(0).required(),
  discrepancyNotes: Joi.string().optional().allow(''),
  cashierId: Joi.string().optional(),
});

const bid = (req: Request) => req.user!.businessId;

export const generateReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dateStr = req.query.date as string;
    const cashierId = req.query.cashierId as string | undefined;
    const date = dateStr ? new Date(dateStr) : new Date();
    if (isNaN(date.getTime())) return next(new ValidationError('Invalid date format'));

    const report = await reconciliationService.generateReport(bid(req), date, cashierId);
    res.json({ success: true, data: report });
  } catch (error) { next(error); }
};

export const submitReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = submitSchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    const date = new Date(value.date);
    if (isNaN(date.getTime())) return next(new ValidationError('Invalid date'));

    const reportData = await reconciliationService.generateReport(bid(req), date, value.cashierId);
    const saved = await reconciliationService.saveReport(bid(req), reportData, value.actualCash, value.discrepancyNotes, req.user!.userId);

    res.status(201).json({ success: true, message: 'Report submitted', data: saved });
  } catch (error) { next(error); }
};

export const getReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const report = await reconciliationService.getReport(bid(req), req.params.id);
    res.json({ success: true, data: report });
  } catch (error) { next(error); }
};

export const listReports = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
    const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;
    const reports = await reconciliationService.listReports(bid(req), startDate, endDate);
    res.json({ success: true, data: reports });
  } catch (error) { next(error); }
};
