import { Request, Response, NextFunction } from 'express';
import { analyticsService } from '../services/analyticsService.js';

const parseDateParam = (val: unknown): Date | undefined => {
  if (!val || typeof val !== 'string') return undefined;
  const d = new Date(val);
  return isNaN(d.getTime()) ? undefined : d;
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
    const endDate = parseDateParam(req.query.endDate) ?? new Date();
    const data = await analyticsService.getSalesSummary(bid(req), startDate, endDate);
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

export const getTopProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const startDate = parseDateParam(req.query.startDate);
    const endDate = parseDateParam(req.query.endDate);
    const data = await analyticsService.getTopProducts(bid(req), limit, startDate, endDate);
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

export const getPaymentBreakdown = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startDate = parseDateParam(req.query.startDate);
    const endDate = parseDateParam(req.query.endDate);
    const data = await analyticsService.getPaymentMethodBreakdown(bid(req), startDate, endDate);
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

export const getProfitReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startDate = parseDateParam(req.query.startDate);
    const endDate = parseDateParam(req.query.endDate);
    const data = await analyticsService.getProfitMargin(bid(req), startDate, endDate);
    res.json({ success: true, data });
  } catch (error) { next(error); }
};

export const getStaffPerformance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const startDate = parseDateParam(req.query.startDate);
    const endDate = parseDateParam(req.query.endDate);
    const data = await analyticsService.getStaffPerformance(bid(req), startDate, endDate);
    res.json({ success: true, data });
  } catch (error) { next(error); }
};
