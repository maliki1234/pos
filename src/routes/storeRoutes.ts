import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import {
  listStores,
  getStore,
  createStore,
  updateStore,
  deactivateStore,
  assignUserToStore,
} from '../controllers/storeController.js';

const router = Router();

router.get('/',                    authenticate, listStores);
router.get('/:storeId',            authenticate, getStore);
router.post('/',                   authenticate, authorize(['ADMIN', 'MANAGER']), createStore);
router.patch('/:storeId',          authenticate, authorize(['ADMIN', 'MANAGER']), updateStore);
router.delete('/:storeId',         authenticate, authorize(['ADMIN']), deactivateStore);
router.post('/assign-user',        authenticate, authorize(['ADMIN', 'MANAGER']), assignUserToStore);

export default router;
