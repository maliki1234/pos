import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { requirePlan } from '../middlewares/requirePlan.js';
import { getCustomerLedger, getLedgerEntry, recordRepayment, getAgingReport, searchAllCredit, getCustomerCreditSummary } from '../controllers/creditController.js';

const router = Router();

const plan = requirePlan('BUSINESS');

router.get('/aging-report',                 authenticate, authorize(['ADMIN', 'MANAGER']), plan, getAgingReport);
router.get('/search',                       authenticate, authorize(['ADMIN', 'MANAGER']), plan, searchAllCredit);
router.get('/customer/:customerId',         authenticate, plan, getCustomerLedger);
router.get('/customer/:customerId/summary', authenticate, getCustomerCreditSummary);
router.get('/:id',                         authenticate, plan, getLedgerEntry);
router.post('/:ledgerId/repay',            authenticate, plan, recordRepayment);

export default router;
