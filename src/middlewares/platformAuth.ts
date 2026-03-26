import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { AppError } from '../utils/errors.js';

export interface PlatformAdminPayload {
  platformAdminId: string;
  email: string;
  isPlatformAdmin: true;
}

declare global {
  namespace Express {
    interface Request {
      platformAdmin?: PlatformAdminPayload;
    }
  }
}

export function authenticatePlatform(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next(new AppError(401, 'Platform admin token required'));

  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, config.jwt.secret) as any;
    if (!payload.isPlatformAdmin) return next(new AppError(403, 'Not a platform admin token'));
    req.platformAdmin = payload as PlatformAdminPayload;
    next();
  } catch {
    next(new AppError(401, 'Invalid or expired token'));
  }
}
