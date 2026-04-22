import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { requirePlan } from '../middlewares/requirePlan.js';
import {
  getDashboardStats,
  getSalesTrend,
  getTopProducts,
  getPaymentBreakdown,
  getProfitReport,
  getStaffPerformance,
} from '../controllers/analyticsController.js';

const router = Router();

// Dashboard stats: all roles, BUSINESS plan
router.get('/dashboard', authenticate, requirePlan('BUSINESS'), getDashboardStats);
// Detailed analytics: ADMIN/MANAGER + BUSINESS plan
router.get('/sales-trend',        authenticate, authorize(['ADMIN', 'MANAGER']), requirePlan('BUSINESS'), getSalesTrend);
router.get('/top-products',       authenticate, authorize(['ADMIN', 'MANAGER']), requirePlan('BUSINESS'), getTopProducts);
router.get('/payment-breakdown',  authenticate, authorize(['ADMIN', 'MANAGER']), requirePlan('BUSINESS'), getPaymentBreakdown);
// Profit is part of core reporting; staff performance remains ENTERPRISE.
router.get('/profit',             authenticate, authorize(['ADMIN', 'MANAGER']), getProfitReport);
router.get('/staff',              authenticate, authorize(['ADMIN', 'MANAGER']), requirePlan('ENTERPRISE'), getStaffPerformance);

export default router;
