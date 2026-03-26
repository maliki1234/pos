import express from 'express';
// import { authenticate, authorize } from '../middlewares/authMiddleware.js';
import {
  createCategory,
  getCategory,
  listCategories,
  updateCategory,
  deleteCategory,
} from '../controllers/categoryController.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = express.Router();

router.get('/', authenticate, listCategories);
router.get('/:id', authenticate, getCategory);

// Protected routes (Admin/Manager only)
router.post('/', authenticate, authorize(['ADMIN', 'MANAGER']), createCategory);
router.put('/:id', authenticate, authorize(['ADMIN', 'MANAGER']), updateCategory);
router.delete('/:id', authenticate, authorize(['ADMIN', 'MANAGER']), deleteCategory);

export default router;
