import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import {
  getCurrent, changePlan, recordPayment, confirmPayment,
  failPayment, refundPayment, getPaymentHistory, suspend, reinstate, cancel,
} from '../controllers/subscriptionController.js';

const router = Router();

router.get('/',               authenticate, getCurrent);
router.get('/payments',       authenticate, authorize(['ADMIN']), getPaymentHistory);
router.post('/change-plan',   authenticate, authorize(['ADMIN']), changePlan);
router.post('/payments',      authenticate, authorize(['ADMIN']), recordPayment);
router.post('/payments/:paymentId/confirm',  authenticate, authorize(['ADMIN']), confirmPayment);
router.post('/payments/:paymentId/fail',     authenticate, authorize(['ADMIN']), failPayment);
router.post('/payments/:paymentId/refund',   authenticate, authorize(['ADMIN']), refundPayment);
router.post('/suspend',       authenticate, authorize(['ADMIN']), suspend);
router.post('/reinstate',     authenticate, authorize(['ADMIN']), reinstate);
router.post('/cancel',        authenticate, authorize(['ADMIN']), cancel);

export default router;
