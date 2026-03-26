import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import {
  createCustomer,
  getCustomer,
  listCustomers,
  updateCustomer,
  deactivateCustomer,
} from '../controllers/customerController.js';

const router = Router();

router.post('/', authenticate, createCustomer);
router.get('/', authenticate, listCustomers);
router.get('/:id', authenticate, getCustomer);
router.put('/:id', authenticate, updateCustomer);
router.delete('/:id', authenticate, authorize(['ADMIN', 'MANAGER']), deactivateCustomer);

export default router;
