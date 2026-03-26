import { Router } from 'express';
// import { authenticate, authorize } from './middlewares/authMiddleware.js';
import {
  getStockBatches,
  addStockBatch,
  getTotalQuantity,
  deductStock,
  updateBatchQuantityUsed,
  getLowStockProducts,
  getExpiredStockBatches,
  setReorderPoint,
} from '../controllers/stockController.js';
import { authenticate, authorize } from '../middlewares/auth.js';

const router = Router();

// Get all stock batches for a product
router.get('/', authenticate, getStockBatches);

// Get total available quantity for a product
router.get('/total-quantity', authenticate, getTotalQuantity);

// Add new stock batch
router.post('/batch', authenticate, authorize(['ADMIN', 'MANAGER']), addStockBatch);

// Deduct stock using FIFO algorithm
router.post('/deduct', authenticate, authorize(['ADMIN', 'CASHIER']), deductStock);

// Update batch quantity used
router.patch('/batch/:batchId', authenticate, authorize(['ADMIN', 'MANAGER']), updateBatchQuantityUsed);

// Get low stock products
router.get('/low-stock', authenticate, authorize(['ADMIN', 'MANAGER']), getLowStockProducts);

// Get expired stock batches
router.get('/expired', authenticate, authorize(['ADMIN', 'MANAGER']), getExpiredStockBatches);

// Set per-product reorder point
router.patch('/reorder-point/:productId', authenticate, authorize(['ADMIN', 'MANAGER']), setReorderPoint);

export default router;
