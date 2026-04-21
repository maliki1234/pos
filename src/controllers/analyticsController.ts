import { Request, Response, NextFunction } from 'express';
import { analyticsService } from '../services/analyticsService.js';

const parseDateParam = (val: unknown): Date | undefined => {
  if (!val || typeof val !== 'string') return undefined;
  const d = new Date(val);
  return isNaN(d.getTime()) ? undefined : d;
};

const parseEndDateParam = (val: unknown): Date | undefined => {
  const d = parseDateParam(val);
  if (!d) return undefined;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val)) {
    d.setHours(23, 59, 59, 999);
  }
  return d;
};

const bid = (req: Request) => req.user!.businessId;

export const getDashboardStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await analyticsService.getDashboardStats(bid(req));
    res.json({ success: true, data: stats });
  } catch (error) { next(error); }
};

export const getSalesTrend = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startDate = parseDateParam(req.query.startDate) ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = parseEndDateParam(req.query.endDate) ?? new Date();
    const data = await analyticsService.getSalesSummary(bid(req), startDate, endDate);
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

export const getTopProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const startDate = parseDateParam(req.query.startDate);
    const endDate = parseEndDateParam(req.query.endDate);
    const data = await analyticsService.getTopProducts(bid(req), limit, startDate, endDate);
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

export const getPaymentBreakdown = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startDate = parseDateParam(req.query.startDate);
    const endDate = parseEndDateParam(req.query.endDate);
    const data = await analyticsService.getPaymentMethodBreakdown(bid(req), startDate, endDate);
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

export const getProfitReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startDate = parseDateParam(req.query.startDate);
    const endDate = parseEndDateParam(req.query.endDate);
    const data = await analyticsService.getProfitSummary(bid(req), startDate, endDate);
    res.json({ success: true, data: data.items, summary: data.summary });
  } catch (error) { next(error); }
};

export const getStaffPerformance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startDate = parseDateParam(req.query.startDate);
    const endDate = parseEndDateParam(req.query.endDate);
    const data = await analyticsService.getStaffPerformance(bid(req), startDate, endDate);
    res.json({ success: true, data });
  } catch (error) { next(error); }
};
