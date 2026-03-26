import { Router } from 'express';
import { authenticatePlatform } from '../middlewares/platformAuth.js';
import {
  platformLogin,
  createPlatformAdmin,
  listBusinesses,
  getBusinessDetail,
  aiCustomerSearch,
  getPlatformStats,
} from '../controllers/platformController.js';

const router = Router();

// Public — protected by master key
router.post('/auth/setup', createPlatformAdmin);
router.post('/auth/login', platformLogin);

// Protected by platform admin JWT
router.get('/stats', authenticatePlatform, getPlatformStats);
router.get('/businesses', authenticatePlatform, listBusinesses);
router.get('/businesses/:id', authenticatePlatform, getBusinessDetail);
router.post('/ai/find-customers', authenticatePlatform, aiCustomerSearch);

export default router;
