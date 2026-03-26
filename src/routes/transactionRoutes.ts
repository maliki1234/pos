import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import {
  createTransaction,
  getTransaction,
  listTransactions,
  voidTransaction,
  returnTransaction,
} from '../controllers/transactionController.js';

const router = Router();

router.post('/', authenticate, authorize(['CASHIER', 'MANAGER', 'ADMIN']), createTransaction);
router.get('/', authenticate, listTransactions);
router.get('/:id', authenticate, getTransaction);
router.post('/:id/void',   authenticate, authorize(['MANAGER', 'ADMIN']), voidTransaction);
router.post('/:id/return', authenticate, authorize(['CASHIER', 'MANAGER', 'ADMIN']), returnTransaction);

export default router;
