import { Router } from 'express';
import { authenticate, authorize } from '../middlewares/auth.js';
import { registerBusiness, register, listStaff, login, getMe, updateProfile } from '../controllers/authController.js';

const router = Router();

router.post('/register-business', registerBusiness);
router.post('/register', authenticate, authorize(['ADMIN', 'MANAGER']), register);
router.get('/staff', authenticate, authorize(['ADMIN', 'MANAGER']), listStaff);
router.get('/me', authenticate, getMe);
router.put('/me', authenticate, updateProfile);
router.post('/login', login);

export default router;
