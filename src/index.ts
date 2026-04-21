import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import config from './config/index.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import logger from './utils/logger.js';

// Routes
import authRoutes from './routes/authRoutes.js';
import productRoutes from './routes/productRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import stockRoutes from './routes/stockRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import customerRoutes from './routes/customerRoutes.js';
import creditRoutes from './routes/creditRoutes.js';
import loyaltyRoutes from './routes/loyaltyRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import reconciliationRoutes from './routes/reconciliationRoutes.js';
import subscriptionRoutes from './routes/subscriptionRoutes.js';
import platformRoutes from './routes/platformRoutes.js';
import storeRoutes from './routes/storeRoutes.js';
import settingsRoutes from './routes/settingsRoutes.js';
import mpesaRoutes from './routes/mpesaRoutes.js';
import recipeRoutes from './routes/recipeRoutes.js';
import conversionRoutes from './routes/conversionRoutes.js';
import azampayRoutes from './routes/azampayRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';

const app = express();

// Middleware
app.use(cors({ origin: config.cors.origin }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'POS System is running',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/categories', categoryRoutes);
app.use('/api/v1/stock', stockRoutes);
app.use('/api/v1/transactions', transactionRoutes);
app.use('/api/v1/customers', customerRoutes);
app.use('/api/v1/credit', creditRoutes);
app.use('/api/v1/loyalty', loyaltyRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/reconciliation', reconciliationRoutes);
app.use('/api/v1/subscription', subscriptionRoutes);
app.use('/api/v1/platform', platformRoutes);
app.use('/api/v1/recipes', recipeRoutes);
app.use('/api/v1/conversions', conversionRoutes);
app.use('/api/v1/expenses', expenseRoutes);
app.use('/api/v1/payments/azampay', azampayRoutes);
app.use('/api/v1/stores', storeRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/payments/mpesa', mpesaRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
const port = config.port;
app.listen(port, () => {
  logger.info(`POS System server running on port ${port}`);
  logger.info(`Environment: ${config.env}`);
});

export default app;
