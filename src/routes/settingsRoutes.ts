import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { getSettings, updateSettings } from '../controllers/settingsController.js';

const router = Router();

router.get('/',  authenticate, authorize(['ADMIN', 'MANAGER']), getSettings);
router.put('/',  authenticate, authorize(['ADMIN']),            updateSettings);

export default router;
