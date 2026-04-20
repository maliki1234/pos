import { Request, Response, NextFunction } from 'express';
import { PaymentMethod } from '@prisma/client';
import Joi from 'joi';
import { ValidationError } from '../utils/errors.js';
import { transactionService } from '../services/transactionService.js';
import logger from '../utils/logger.js';

const createTransactionSchema = Joi.object({
  storeId:    Joi.string().uuid().optional().allow(null),
  customerId: Joi.string().optional(),
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.number().required(),
        quantity: Joi.number().integer().positive().required(),
        discount: Joi.number().min(0).optional(),
      })
    )
    .min(1)
    .required(),
  paymentMethod: Joi.string()
    .valid('CASH', 'CARD', 'CHEQUE', 'BANK_TRANSFER', 'MOBILE_MONEY', 'AZAMPAY', 'CREDIT')
    .required(),
  payments: Joi.array().items(Joi.object({ method: Joi.string().required(), amount: Joi.number().positive().required() })).optional(),
  mpesaRef: Joi.string().optional().allow('', null),
  dueDate: Joi.date().when('paymentMethod', { is: 'CREDIT', then: Joi.required() }),
  loyaltyPointsToRedeem: Joi.number().integer().min(0).optional(),
  notes: Joi.string().optional(),
});

const voidTransactionSchema = Joi.object({
  reason: Joi.string().min(5).required(),
});

export const createTransaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = createTransactionSchema.validate(req.body);

    if (error) {
      return next(new ValidationError(error.details[0].message));
    }

    const transaction = await transactionService.createTransaction({
      businessId: req.user!.businessId,
      storeId: value.storeId ?? undefined,
      customerId: value.customerId,
      userId: req.user!.userId,
      items: value.items,
      paymentMethod: value.paymentMethod as PaymentMethod,
      payments: value.payments,
      mpesaRef: value.mpesaRef,
      notes: value.notes,
      dueDate: value.dueDate ? new Date(value.dueDate) : undefined,
      loyaltyPointsToRedeem: value.loyaltyPointsToRedeem,
    });

    logger.info(`Transaction created: ${transaction.transactionNo} by ${req.user!.email}`);

    res.status(201).json({
      success: true,
      message: 'Transaction processed successfully',
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

export const getTransaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    let transaction;

    if (req.params.id.startsWith('TXN-')) {
      transaction = await transactionService.getTransactionByNo(req.params.id);
    } else {
      transaction = await transactionService.getTransaction(req.params.id);
    }

    res.json({
      success: true,
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};

export const listTransactions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customerId, userId, paymentStatus, startDate, endDate, skip, take } = req.query;

    const filters: any = {};
    if (customerId) filters.customerId = customerId;
    if (userId) filters.userId = userId;
    if (paymentStatus) filters.paymentStatus = paymentStatus;
    if (startDate) filters.startDate = new Date(startDate as string);
    if (endDate) filters.endDate = new Date(endDate as string);
    if (skip) filters.skip = parseInt(skip as string);
    if (take) filters.take = parseInt(take as string);

    const result = await transactionService.listTransactions(req.user!.businessId, filters);

    res.json({
      success: true,
      data: result.transactions,
      pagination: {
        total: result.total,
        skip: filters.skip || 0,
        take: filters.take || 50,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const returnTransaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const schema = Joi.object({
      items: Joi.array().items(
        Joi.object({ productId: Joi.number().required(), quantity: Joi.number().integer().positive().required() })
      ).min(1).required(),
      reason: Joi.string().min(3).required(),
    });
    const { error, value } = schema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    const returnTxn = await transactionService.returnTransaction(
      req.user!.businessId,
      req.params.id,
      value.items,
      value.reason
    );

    logger.info(`Return processed: ${returnTxn.transactionNo} by ${req.user!.email}`);
    res.status(201).json({ success: true, message: 'Return processed successfully', data: returnTxn });
  } catch (error) { next(error); }
};

export const voidTransaction = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = voidTransactionSchema.validate(req.body);

    if (error) {
      return next(new ValidationError(error.details[0].message));
    }

    const transaction = await transactionService.voidTransaction(req.user!.businessId, req.params.id, value.reason);

    logger.info(
      `Transaction voided: ${transaction.transactionNo} by ${req.user!.email}`
    );

    res.json({
      success: true,
      message: 'Transaction voided successfully',
      data: transaction,
    });
  } catch (error) {
    next(error);
  }
};
