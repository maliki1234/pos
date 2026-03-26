import { Router } from 'express';
import { authenticate } from '../middlewares/auth.js';
import { stkPush, stkStatus, stkCallback } from '../controllers/mpesaController.js';

const router = Router();

router.post('/stk-push',                  authenticate, stkPush);
router.get('/status/:checkoutRequestId',  authenticate, stkStatus);
router.post('/callback',                  stkCallback);   // No auth — Safaricom calls this

export default router;
