import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import {
  createExpense,
  deactivateExpense,
  getExpense,
  listExpenses,
  updateExpense,
} from '../controllers/expenseController.js';

const router = Router();

router.get('/', authenticate, authorize(['ADMIN', 'MANAGER']), listExpenses);
router.post('/', authenticate, authorize(['ADMIN', 'MANAGER']), createExpense);
router.get('/:id', authenticate, authorize(['ADMIN', 'MANAGER']), getExpense);
router.patch('/:id', authenticate, authorize(['ADMIN', 'MANAGER']), updateExpense);
router.delete('/:id', authenticate, authorize(['ADMIN', 'MANAGER']), deactivateExpense);

export default router;
