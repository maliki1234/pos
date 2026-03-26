import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { listConversions, convertStock, simulateConversion } from '../controllers/conversionController.js';

const router = Router();

router.get('/',           authenticate, authorize(['ADMIN', 'MANAGER']), listConversions);
router.post('/convert',   authenticate, authorize(['ADMIN', 'MANAGER']), convertStock);
router.post('/simulate',  authenticate, authorize(['ADMIN', 'MANAGER']), simulateConversion);

export default router;
