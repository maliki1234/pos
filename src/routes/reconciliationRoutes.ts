import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { requirePlan } from '../middlewares/requirePlan.js';
import { generateReport, submitReport, getReport, listReports } from '../controllers/reconciliationController.js';

const router = Router();

const plan = requirePlan('ENTERPRISE');

router.get('/generate', authenticate, plan, generateReport);
router.post('/submit',  authenticate, plan, submitReport);
router.get('/',         authenticate, authorize(['ADMIN', 'MANAGER']), plan, listReports);
router.get('/:id',      authenticate, authorize(['ADMIN', 'MANAGER']), plan, getReport);

export default router;
