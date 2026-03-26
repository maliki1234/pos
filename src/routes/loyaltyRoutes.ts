import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { requirePlan } from '../middlewares/requirePlan.js';
import { getCustomerLoyalty, redeemAtCheckout, adjustPoints } from '../controllers/loyaltyController.js';

const router = Router();

const plan = requirePlan('BUSINESS');

router.get('/customer/:customerId', authenticate, plan, getCustomerLoyalty);
router.post('/redeem',             authenticate, plan, redeemAtCheckout);
router.post('/adjust',             authenticate, authorize(['ADMIN']), plan, adjustPoints);

export default router;
