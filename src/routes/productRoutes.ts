import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import {
  createProduct,
  getProduct,
  listProducts,
  updateProduct,
  deactivateProduct,
  setProductPrice,
} from '../controllers/productController.js';

const router = Router();

router.post('/', authenticate, authorize(['ADMIN', 'MANAGER']), createProduct);
router.get('/', authenticate, listProducts);
router.get('/:id', authenticate, getProduct);
router.put('/:id', authenticate, authorize(['ADMIN', 'MANAGER']), updateProduct);
router.delete('/:id', authenticate, authorize(['ADMIN', 'MANAGER']), deactivateProduct);
router.post('/:id/pricing', authenticate, authorize(['ADMIN', 'MANAGER']), setProductPrice);

export default router;
