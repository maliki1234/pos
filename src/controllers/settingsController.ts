import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ValidationError } from '../utils/errors.js';
import { prisma } from '../utils/prisma.js';
import logger from '../utils/logger.js';

const updateSettingsSchema = Joi.object({
  name:       Joi.string().optional(),
  email:      Joi.string().email().optional().allow('', null),
  phone:      Joi.string().optional().allow('', null),
  address:    Joi.string().optional().allow('', null),
  country:    Joi.string().optional(),
  currency:   Joi.string().optional(),
  // eTIMS
  etimsEnabled: Joi.boolean().optional(),
  etimsPin:     Joi.string().optional().allow('', null),
  etimsBhfId:   Joi.string().optional().allow('', null),
  // M-Pesa
  mpesaEnabled:        Joi.boolean().optional(),
  mpesaShortcode:      Joi.string().optional().allow('', null),
  mpesaPasskey:        Joi.string().optional().allow('', null),
  mpesaConsumerKey:    Joi.string().optional().allow('', null),
  mpesaConsumerSecret: Joi.string().optional().allow('', null),
  mpesaCallbackUrl:    Joi.string().optional().allow('', null),
  // Azampay
  azampayEnabled:      Joi.boolean().optional(),
  azampayAppName:      Joi.string().optional().allow('', null),
  azampayClientId:     Joi.string().optional().allow('', null),
  azampayClientSecret: Joi.string().optional().allow('', null),
  azampayCallbackUrl:  Joi.string().optional().allow('', null),
});

export const getSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.user!.businessId },
      select: {
        id: true, name: true, email: true, phone: true, address: true,
        country: true, currency: true,
        etimsEnabled: true, etimsPin: true, etimsBhfId: true,
        mpesaEnabled: true, mpesaShortcode: true, mpesaCallbackUrl: true,
        // Never return secret keys to frontend — mask them
        mpesaConsumerKey: true, mpesaPasskey: true,
        // Azampay
        azampayEnabled: true, azampayAppName: true, azampayClientId: true,
        azampayClientSecret: true, azampayCallbackUrl: true,
      },
    });
    if (!business) return next(new ValidationError('Business not found'));

    // Mask secrets — return boolean indicating if configured
    const safeData = {
      ...business,
      mpesaConsumerKey:    business.mpesaConsumerKey    ? '••••••' : null,
      mpesaPasskey:        business.mpesaPasskey        ? '••••••' : null,
      mpesaConsumerKeySet: !!business.mpesaConsumerKey,
      mpesaPasskeySet:     !!business.mpesaPasskey,
      // Mask Azampay secret
      azampayClientSecret: business.azampayClientSecret ? '••••••' : null,
    };

    res.json({ success: true, data: safeData });
  } catch (error) { next(error); }
};

export const updateSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { error, value } = updateSettingsSchema.validate(req.body);
    if (error) return next(new ValidationError(error.details[0].message));

    // Don't update masked placeholder values
    if (value.mpesaConsumerKey    === '••••••') delete value.mpesaConsumerKey;
    if (value.mpesaPasskey        === '••••••') delete value.mpesaPasskey;
    if (value.azampayClientSecret === '••••••') delete value.azampayClientSecret;

    const business = await prisma.business.update({
      where: { id: req.user!.businessId },
      data: value,
    });

    logger.info(`Business settings updated: ${business.id}`);
    res.json({ success: true, message: 'Settings updated successfully', data: { id: business.id } });
  } catch (error) { next(error); }
};
