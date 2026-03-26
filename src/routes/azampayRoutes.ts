import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { checkout, callback } from '../controllers/azampayController.js';

const router = Router();

router.post('/checkout', authenticate, checkout);
router.post('/callback', callback); // No auth — Azampay calls this directly

export default router;
