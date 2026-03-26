import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import {
  createProduct,
  getProduct,
  listProducts,
  updateProduct,
  setProductPrice,
} from '../controllers/productController.js';

const router = Router();

router.post('/', authenticate, authorize(['ADMIN', 'MANAGER']), createProduct);
router.get('/', authenticate, listProducts);
router.get('/:id', authenticate, getProduct);
router.put('/:id', authenticate, authorize(['ADMIN', 'MANAGER']), updateProduct);
router.post('/:id/pricing', authenticate, authorize(['ADMIN', 'MANAGER']), setProductPrice);

export default router;
