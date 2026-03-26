import { Prisma, CustomerType } from '@prisma/client';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import logger from '../utils/logger.js';
import { prisma } from '../utils/prisma.js';

type TxClient = Prisma.TransactionClient;

export class PriceService {
  async getPrice(productId: number, customerType: CustomerType, quantity: number, tx?: TxClient) {
    const db = tx ?? prisma;

    const product = await db.product.findUnique({ where: { id: productId } });
    if (!product) {
      throw new NotFoundError('Product');
    }

    const price = await db.productPrice.findFirst({
      where: { productId, customerType, minQuantity: { lte: quantity }, isActive: true },
      orderBy: { minQuantity: 'desc' },
    });

    if (!price) {
      throw new NotFoundError(
        `Price for product ${product.name} and customer type ${customerType}`
      );
    }

    return price;
  }

  async createPrice(
    productId: number,
    customerType: CustomerType,
    unitPrice: number,
    costPrice: number,
    minQuantity: number = 1,
    discount: number = 0
  ) {
    if (unitPrice <= 0 || costPrice <= 0) {
      throw new ValidationError('Prices must be greater than 0');
    }

    if (unitPrice < costPrice) {
      throw new ValidationError('Unit price cannot be less than cost price');
    }

    if (discount < 0 || discount > 100) {
      throw new ValidationError('Discount must be between 0 and 100');
    }

    const existingPrice = await prisma.productPrice.findUnique({
      where: { productId_customerType_minQuantity: { productId, customerType, minQuantity } },
    });

    if (existingPrice) {
      return prisma.productPrice.update({
        where: { id: existingPrice.id },
        data: {
          unitPrice: unitPrice.toString(),
          costPrice: costPrice.toString(),
          discount: discount.toString(),
        },
      });
    }

    return prisma.productPrice.create({
      data: {
        productId,
        customerType,
        unitPrice: unitPrice.toString(),
        costPrice: costPrice.toString(),
        minQuantity,
        discount: discount.toString(),
      },
    });
  }

  async calculateLineTotal(
    productId: number,
    customerType: CustomerType,
    quantity: number,
    tx?: TxClient
  ): Promise<{ unitPrice: number; lineTotal: number; discount: number }> {
    const price = await this.getPrice(productId, customerType, quantity, tx);
    const unitPrice = parseFloat(price.unitPrice.toString());
    const discountPct = parseFloat(price.discount.toString());

    const discountAmount = (unitPrice * discountPct) / 100;
    const finalPrice = unitPrice - discountAmount;
    const lineTotal = finalPrice * quantity;

    return { unitPrice: finalPrice, lineTotal, discount: discountAmount };
  }
}

export const priceService = new PriceService();
