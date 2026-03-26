import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../utils/prisma.js';
import config from '../config/index.js';
import { AppError } from '../utils/errors.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Auth ────────────────────────────────────────────────────────────────────

export const platformLogin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) throw new AppError(400, 'Email and password required');

    const admin = await prisma.platformAdmin.findUnique({ where: { email } });
    if (!admin) throw new AppError(401, 'Invalid credentials');

    const valid = await bcrypt.compare(password, admin.passwordHash);
    if (!valid) throw new AppError(401, 'Invalid credentials');

    const token = jwt.sign(
      { platformAdminId: admin.id, email: admin.email, isPlatformAdmin: true },
      config.jwt.secret,
      { expiresIn: '12h' }
    );

    res.json({ success: true, data: { token, admin: { id: admin.id, email: admin.email, name: admin.name } } });
  } catch (err) { next(err); }
};

export const createPlatformAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name, masterKey } = req.body;
    if (masterKey !== process.env.PLATFORM_MASTER_KEY) throw new AppError(403, 'Invalid master key');

    const exists = await prisma.platformAdmin.findUnique({ where: { email } });
    if (exists) throw new AppError(409, 'Email already registered');

    const passwordHash = await bcrypt.hash(password, 12);
    const admin = await prisma.platformAdmin.create({ data: { email, name, passwordHash } });

    res.status(201).json({ success: true, data: { id: admin.id, email: admin.email, name: admin.name } });
  } catch (err) { next(err); }
};

// ── Tenant Management ───────────────────────────────────────────────────────

export const listBusinesses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { search, plan, status, page = '1', limit = '20' } = req.query as Record<string, string>;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const businesses = await prisma.business.findMany({
      where: {
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
        ...(plan || status ? {
          subscription: {
            ...(plan ? { plan: plan as any } : {}),
            ...(status ? { status: status as any } : {}),
          }
        } : {}),
      },
      include: {
        subscription: { select: { plan: true, status: true, endDate: true } },
        _count: { select: { users: true, customers: true, transactions: true, products: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: parseInt(limit),
    });

    const total = await prisma.business.count({
      where: {
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      }
    });

    res.json({ success: true, data: businesses, meta: { total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) { next(err); }
};

export const getBusinessDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const business = await prisma.business.findUnique({
      where: { id },
      include: {
        subscription: { include: { payments: { orderBy: { createdAt: 'desc' }, take: 5 } } },
        _count: { select: { users: true, customers: true, transactions: true, products: true } },
      },
    });
    if (!business) throw new AppError(404, 'Business not found');

    // Revenue last 30 days
    const thirtyAgo = new Date(Date.now() - 30 * 86400000);
    const revenue = await prisma.transaction.aggregate({
      where: { businessId: id, createdAt: { gte: thirtyAgo }, isVoided: false },
      _sum: { totalAmount: true },
      _count: true,
    });

    res.json({
      success: true,
      data: {
        ...business,
        stats: {
          revenueLastMonth: revenue._sum.totalAmount ?? 0,
          transactionsLastMonth: revenue._count,
        },
      },
    });
  } catch (err) { next(err); }
};

// ── AI Customer Finder ──────────────────────────────────────────────────────

export const aiCustomerSearch = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { businessId, query } = req.body;
    if (!businessId || !query) throw new AppError(400, 'businessId and query required');

    const business = await prisma.business.findUnique({ where: { id: businessId }, select: { name: true, currency: true } });
    if (!business) throw new AppError(404, 'Business not found');

    // Fetch customer data for context
    const customers = await prisma.customer.findMany({
      where: { businessId, isActive: true },
      include: {
        transactions: {
          where: { isVoided: false },
          select: { totalAmount: true, createdAt: true, paymentMethod: true },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        creditLedger: {
          select: { outstandingBalance: true, status: true, dueDate: true },
        },
        loyaltyAccount: {
          select: { totalPoints: true, tier: true },
        },
      },
      take: 200,
    });

    // Build a compact summary for the AI
    const customerSummary = customers.map(c => ({
      id: c.id,
      name: c.name,
      email: c.email,
      phone: c.phone,
      type: c.customerType,
      totalTransactions: c.transactions.length,
      totalSpent: c.transactions.reduce((s, t) => s + Number(t.totalAmount), 0),
      lastPurchase: c.transactions[0]?.createdAt ?? null,
      outstandingCredit: c.creditLedger.filter(l => l.status !== 'SETTLED')
        .reduce((s, l) => s + Number(l.outstandingBalance), 0),
      hasOverdueCredit: c.creditLedger.some(l => l.status === 'OVERDUE'),
      loyaltyTier: c.loyaltyAccount?.tier ?? null,
      loyaltyPoints: c.loyaltyAccount?.totalPoints ?? 0,
    }));

    const systemPrompt = `You are a business intelligence assistant for "${business.name}".
You help find and analyze customers based on natural language queries.
Currency: ${business.currency}.

When given a query, identify matching customers from the data and return:
1. A short explanation of what you found
2. A list of matching customer IDs
3. Key insights about those customers

Always respond in JSON with this structure:
{
  "explanation": "...",
  "matchedIds": ["id1", "id2", ...],
  "insights": "...",
  "count": number
}`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      system: systemPrompt,
      messages: [{
        role: 'user',
        content: `Customer data:\n${JSON.stringify(customerSummary, null, 2)}\n\nQuery: "${query}"`
      }],
    });

    const content = response.content[0];
    if (content.type !== 'text') throw new AppError(500, 'AI response error');

    let aiResult: any;
    try {
      // Extract JSON from response (it may have markdown code fences)
      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      aiResult = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(content.text);
    } catch {
      aiResult = { explanation: content.text, matchedIds: [], insights: '', count: 0 };
    }

    // Fetch full matched customer records
    const matchedCustomers = aiResult.matchedIds?.length
      ? customers
          .filter(c => aiResult.matchedIds.includes(c.id))
          .map(c => customerSummary.find(s => s.id === c.id))
          .filter(Boolean)
      : [];

    res.json({
      success: true,
      data: {
        explanation: aiResult.explanation,
        insights: aiResult.insights,
        count: matchedCustomers.length,
        customers: matchedCustomers,
      },
    });
  } catch (err) { next(err); }
};

// ── Platform Stats ──────────────────────────────────────────────────────────

export const getPlatformStats = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [totalBusinesses, planBreakdown, recentBusinesses] = await Promise.all([
      prisma.business.count(),
      prisma.subscription.groupBy({ by: ['plan'], _count: true }),
      prisma.business.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { subscription: { select: { plan: true, status: true } } },
      }),
    ]);

    res.json({
      success: true,
      data: {
        totalBusinesses,
        planBreakdown: Object.fromEntries(planBreakdown.map(p => [p.plan, p._count])),
        recentBusinesses,
      },
    });
  } catch (err) { next(err); }
};
