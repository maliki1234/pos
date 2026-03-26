import { prisma } from '../utils/prisma.js';
import logger from '../utils/logger.js';

const AZAMPAY_PROD    = 'https://azampay.co.tz';
const AZAMPAY_SANDBOX = 'https://sandbox.azampay.co.tz';

// Detect sandbox by clientId prefix (sandbox IDs start with "sandbox-")
function isSandbox(clientId: string): boolean {
  return clientId.toLowerCase().startsWith('sandbox');
}

function base(sandbox: boolean) {
  return sandbox ? AZAMPAY_SANDBOX : AZAMPAY_PROD;
}

// Detect mobile network from Tanzanian phone number prefix
function detectProvider(phone: string): string {
  const cleaned = phone.replace(/\D/g, '').replace(/^255/, '').replace(/^0/, '');
  const prefix = cleaned.slice(0, 2);

  const vodacom  = ['74', '75', '76']; // Vodacom M-Pesa TZ
  const airtel   = ['68', '69', '78', '79'];
  const tigo     = ['71', '67', '65'];
  const halotel  = ['62', '61'];

  if (vodacom.includes(prefix))  return 'Azampesa'; // Vodacom M-Pesa TZ uses "Azampesa"
  if (airtel.includes(prefix))   return 'Airtel';
  if (tigo.includes(prefix))     return 'Tigo';
  if (halotel.includes(prefix))  return 'Halopesa';
  return 'Azampesa'; // default to M-Pesa TZ
}

function formatPhone(phone: string): string {
  // Normalize to 255XXXXXXXXX
  return phone.replace(/\s+/g, '').replace(/^0/, '255').replace(/^\+/, '');
}

async function getToken(appName: string, clientId: string, clientSecret: string, sandbox: boolean): Promise<string> {
  const res = await fetch(`${base(sandbox)}/AppRegistration/GenerateToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ appName, clientId, clientSecret }),
  });
  if (!res.ok) throw new Error(`Azampay auth failed: ${res.status}`);
  const data: any = await res.json();
  if (!data.accessToken) throw new Error('Azampay token missing in response');
  return data.accessToken;
}

// ── In-memory pending payments map ───────────────────────────────────────────
const pendingPayments = new Map<string, {
  businessId: string;
  resolve: (ref: string) => void;
  reject:  (err: Error) => void;
}>();

export async function initiateAzampayCheckout(
  businessId: string,
  phone: string,
  amount: number,
  externalId: string,
) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      azampayEnabled: true, azampayAppName: true,
      azampayClientId: true, azampayClientSecret: true, azampayCallbackUrl: true,
    },
  });

  if (!business?.azampayEnabled)      throw new Error('Azampay is not enabled for this business');
  if (!business.azampayAppName)        throw new Error('Azampay App Name not configured');
  if (!business.azampayClientId)       throw new Error('Azampay Client ID not configured');
  if (!business.azampayClientSecret)   throw new Error('Azampay Client Secret not configured');
  if (!business.azampayCallbackUrl)    throw new Error('Azampay Callback URL not configured');

  const sandbox   = isSandbox(business.azampayClientId);
  const token     = await getToken(business.azampayAppName, business.azampayClientId, business.azampayClientSecret, sandbox);
  const provider  = detectProvider(phone);
  const reference = `BIZ_${businessId.slice(0, 8)}_${externalId}`;

  const body = {
    accountNumber:        formatPhone(phone),
    additionalProperties: {},
    amount:               String(Math.ceil(amount)),
    currency:             'TZS',
    externalId:           reference,
    provider,
  };

  const res = await fetch(`${base(sandbox)}/azampay/mno/checkout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data: any = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Azampay checkout failed');
  }

  logger.info(`Azampay checkout initiated: ${reference} via ${provider}`);
  return { externalId: reference, provider, transactionId: data.transactionId };
}

export function registerAzampayPending(
  externalId: string,
  businessId: string,
  resolve: (ref: string) => void,
  reject:  (err: Error) => void,
) {
  pendingPayments.set(externalId, { businessId, resolve, reject });
  // Auto-expire after 3 minutes
  setTimeout(() => {
    if (pendingPayments.has(externalId)) {
      pendingPayments.get(externalId)?.reject(new Error('Azampay payment timed out'));
      pendingPayments.delete(externalId);
    }
  }, 180000);
}

export function resolveAzampayCallback(externalId: string, success: boolean, reference: string) {
  const entry = pendingPayments.get(externalId);
  if (!entry) return;
  pendingPayments.delete(externalId);
  if (success) {
    entry.resolve(reference);
  } else {
    entry.reject(new Error('Azampay payment failed or was cancelled'));
  }
}

export function getBusinessFromExternalId(externalId: string): string | null {
  const entry = pendingPayments.get(externalId);
  return entry?.businessId ?? null;
}
