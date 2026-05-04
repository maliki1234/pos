import { Request, Response, NextFunction } from 'express';
import bcryptjs from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import Joi from 'joi';
import config from '../config/index.js';
import { ValidationError, ConflictError, NotFoundError } from '../utils/errors.js';
import { enforcePlanLimit } from '../utils/planLimits.js';
import logger from '../utils/logger.js';
import { prisma } from '../utils/prisma.js';

const registerBusinessSchema = Joi.object({
  businessName: Joi.string().required(),
  businessEmail: Joi.string().email().optional(),
  country: Joi.string().optional(),
  currency: Joi.string().optional(),
  email: Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  name: Joi.string().required(),
});

const addUserSchema = Joi.object({
  email:   Joi.string().email().required(),
  password: Joi.string().min(6).required(),
  name:    Joi.string().required(),
  role:    Joi.string().valid('ADMIN', 'MANAGER', 'CASHIER').optional(),
  storeId: Joi.string().uuid().optional().allow(null),
});

const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required(),
});

const updateProfileSchema = Joi.object({
  name: Joi.string().min(2).optional(),
  email: Joi.string().email().optional(),
  currentPassword: Joi.string().optional(),
  newPassword: Joi.string().min(6).optional(),
}).or('name', 'email', 'newPassword');

const makeToken = (userId: string, businessId: string, email: string, role: string) =>
  jwt.sign(
    { userId, businessId, email, role },
    config.jwt.secret,
    { expiresIn: config.jwt.expiry as SignOptions['expiresIn'] }
  );

/** POST /auth/register-business — creates a new tenant + first ADMIN user */
export const registerBusiness = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = registerBusinessSchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    const existingUser = await prisma.user.findUnique({ where: { email: value.email } });
    if (existingUser) return next(new ConflictError('Email already registered'));

    const result = await prisma.$transaction(async (tx) => {
      const business = await tx.business.create({
        data: {
          name: value.businessName,
          email: value.businessEmail,
          country: value.country ?? 'KE',
          currency: value.currency ?? 'KES',
        },
      });

      const hashedPassword = await bcryptjs.hash(value.password, 10);
      const user = await tx.user.create({
        data: {
          businessId: business.id,
          email: value.email,
          password: hashedPassword,
          name: value.name,
          role: 'ADMIN',
        },
      });

      // Auto-create STARTER subscription for the new business
      await tx.subscription.create({
        data: { businessId: business.id, plan: 'STARTER', status: 'ACTIVE' },
      });

      // Auto-create a default "Main Store" for the new business
      await tx.store.create({
        data: {
          businessId: business.id,
          name: 'Main Store',
          isDefault: true,
        },
      });

      return { business, user };
    });

    const token = makeToken(result.user.id, result.business.id, result.user.email, result.user.role);
    logger.info(`New business registered: ${result.business.name} (${result.user.email})`);

    res.status(201).json({
      success: true,
      message: 'Business registered successfully',
      data: {
        token,
        user: {
          id: result.user.id,
          email: result.user.email,
          name: result.user.name,
          role: result.user.role,
          businessId: result.business.id,
          businessName: result.business.name,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/** POST /auth/register — add a staff member to your business (requires auth) */
export const register = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = addUserSchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    if (!req.user?.businessId) return next(new ValidationError('Authentication required'));

    const existingUser = await prisma.user.findUnique({ where: { email: value.email } });
    if (existingUser) return next(new ConflictError('Email already registered'));

    // Enforce plan user limit before creating
    await enforcePlanLimit(req.user.businessId, 'users');

    const hashedPassword = await bcryptjs.hash(value.password, 10);
    const user = await prisma.user.create({
      data: {
        businessId: req.user.businessId,
        email: value.email,
        password: hashedPassword,
        name: value.name,
        role: value.role ?? 'CASHIER',
        storeId: value.storeId ?? null,
      },
    });

    const token = makeToken(user.id, user.businessId, user.email, user.role);
    logger.info(`Staff member added: ${user.email} to business ${user.businessId}`);

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          storeId: user.storeId,
          businessId: user.businessId,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/** GET /auth/staff — list all staff for the business */
export const listStaff = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.businessId) return next(new ValidationError('Authentication required'));
    const staff = await prisma.user.findMany({
      where: { businessId: req.user.businessId },
      select: {
        id: true, name: true, email: true, role: true, isActive: true, storeId: true,
        store: { select: { id: true, name: true } },
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    });
    res.json({ success: true, data: staff });
  } catch (error) {
    next(error);
  }
};

/** GET /auth/me */
export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.userId || !req.user.businessId) return next(new ValidationError('Authentication required'));

    const user = await prisma.user.findFirst({
      where: { id: req.user.userId, businessId: req.user.businessId, isActive: true },
      include: { business: { select: { id: true, name: true, currency: true } } },
    });

    if (!user) return next(new NotFoundError('User'));

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          storeId: user.storeId,
          businessId: user.businessId,
          businessName: user.business.name,
          currency: user.business.currency,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/** PUT /auth/me */
export const updateProfile = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?.userId || !req.user.businessId) return next(new ValidationError('Authentication required'));

    const { error, value } = updateProfileSchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    const user = await prisma.user.findFirst({
      where: { id: req.user.userId, businessId: req.user.businessId, isActive: true },
      include: { business: { select: { id: true, name: true, currency: true } } },
    });

    if (!user) return next(new NotFoundError('User'));

    if (value.email && value.email !== user.email) {
      const existingUser = await prisma.user.findUnique({ where: { email: value.email } });
      if (existingUser) return next(new ConflictError('Email already registered'));
    }

    const updates: { name?: string; email?: string; password?: string } = {};
    if (value.name) updates.name = value.name;
    if (value.email) updates.email = value.email;

    if (value.newPassword) {
      if (!value.currentPassword) return next(new ValidationError('Current password is required'));
      const valid = await bcryptjs.compare(value.currentPassword, user.password);
      if (!valid) return next(new ValidationError('Current password is incorrect'));
      updates.password = await bcryptjs.hash(value.newPassword, 10);
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: updates,
      include: { business: { select: { id: true, name: true, currency: true } } },
    });

    const token = makeToken(updated.id, updated.businessId, updated.email, updated.role);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        token,
        user: {
          id: updated.id,
          email: updated.email,
          name: updated.name,
          role: updated.role,
          storeId: updated.storeId,
          businessId: updated.businessId,
          businessName: updated.business.name,
          currency: updated.business.currency,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/** POST /auth/login */
export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = loginSchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    const user = await prisma.user.findUnique({
      where: { email: value.email },
      include: { business: { select: { id: true, name: true, currency: true } } },
    });

    if (!user || !user.isActive) return next(new ValidationError('Invalid email or password'));

    const isPasswordValid = await bcryptjs.compare(value.password, user.password);
    if (!isPasswordValid) return next(new ValidationError('Invalid email or password'));

    const token = makeToken(user.id, user.businessId, user.email, user.role);
    logger.info(`User logged in: ${user.email}`);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          storeId: user.storeId,
          businessId: user.businessId,
          businessName: user.business.name,
          currency: user.business.currency,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
