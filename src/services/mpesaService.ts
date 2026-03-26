import { prisma } from '../utils/prisma.js';
import logger from '../utils/logger.js';

const DARAJA_BASE = 'https://api.safaricom.co.ke';
const DARAJA_SANDBOX = 'https://sandbox.safaricom.co.ke';

function base(sandbox: boolean) {
  return sandbox ? DARAJA_SANDBOX : DARAJA_BASE;
}

async function getAccessToken(consumerKey: string, consumerSecret: string, sandbox: boolean) {
  const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  const res = await fetch(
    `${base(sandbox)}/oauth/v1/generate?grant_type=client_credentials`,
    { headers: { Authorization: `Basic ${credentials}` } }
  );
  if (!res.ok) throw new Error('M-Pesa auth failed');
  const data: any = await res.json();
  return data.access_token as string;
}

function getTimestamp() {
  return new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
}

function getPassword(shortcode: string, passkey: string, timestamp: string) {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
}

function formatPhone(phone: string) {
  // Normalize to 254XXXXXXXXX
  const cleaned = phone.replace(/\s+/g, '').replace(/^0/, '254').replace(/^\+/, '');
  return cleaned;
}

export async function initiateStkPush(businessId: string, phone: string, amount: number, reference: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: {
      mpesaEnabled: true, mpesaShortcode: true, mpesaPasskey: true,
      mpesaConsumerKey: true, mpesaConsumerSecret: true, mpesaCallbackUrl: true,
    },
  });

  if (!business?.mpesaEnabled)      throw new Error('M-Pesa is not enabled for this business');
  if (!business.mpesaShortcode)      throw new Error('M-Pesa shortcode not configured');
  if (!business.mpesaPasskey)        throw new Error('M-Pesa passkey not configured');
  if (!business.mpesaConsumerKey)    throw new Error('M-Pesa consumer key not configured');
  if (!business.mpesaConsumerSecret) throw new Error('M-Pesa consumer secret not configured');
  if (!business.mpesaCallbackUrl)    throw new Error('M-Pesa callback URL not configured');

  // Use sandbox if shortcode starts with 174 (Safaricom sandbox default)
  const sandbox = business.mpesaShortcode.startsWith('174');

  const token = await getAccessToken(business.mpesaConsumerKey, business.mpesaConsumerSecret, sandbox);
  const timestamp = getTimestamp();
  const password = getPassword(business.mpesaShortcode, business.mpesaPasskey, timestamp);

  const body = {
    BusinessShortCode: business.mpesaShortcode,
    Password:          password,
    Timestamp:         timestamp,
    TransactionType:   'CustomerPayBillOnline',
    Amount:            Math.ceil(amount),
    PartyA:            formatPhone(phone),
    PartyB:            business.mpesaShortcode,
    PhoneNumber:       formatPhone(phone),
    CallBackURL:       business.mpesaCallbackUrl,
    AccountReference:  reference.slice(0, 12),
    TransactionDesc:   'POS Sale',
  };

  const res = await fetch(`${base(sandbox)}/mpesa/stkpush/v1/processrequest`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data: any = await res.json();
  if (data.ResponseCode !== '0') throw new Error(data.errorMessage || data.ResponseDescription || 'STK push failed');

  logger.info(`M-Pesa STK Push initiated: ${data.CheckoutRequestID}`);
  return { checkoutRequestId: data.CheckoutRequestID, merchantRequestId: data.MerchantRequestID };
}

export async function queryStkStatus(businessId: string, checkoutRequestId: string) {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { mpesaShortcode: true, mpesaPasskey: true, mpesaConsumerKey: true, mpesaConsumerSecret: true },
  });

  if (!business?.mpesaShortcode || !business.mpesaPasskey || !business.mpesaConsumerKey || !business.mpesaConsumerSecret)
    throw new Error('M-Pesa not configured');

  const sandbox = business.mpesaShortcode.startsWith('174');
  const token = await getAccessToken(business.mpesaConsumerKey, business.mpesaConsumerSecret, sandbox);
  const timestamp = getTimestamp();
  const password = getPassword(business.mpesaShortcode, business.mpesaPasskey, timestamp);

  const res = await fetch(`${base(sandbox)}/mpesa/stkpushquery/v1/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      BusinessShortCode: business.mpesaShortcode,
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId,
    }),
  });

  const data: any = await res.json();
  // ResultCode 0 = success, 1032 = cancelled, 1037 = timeout
  return {
    resultCode:    data.ResultCode,
    resultDesc:    data.ResultDesc,
    paid:          data.ResultCode === '0' || data.ResultCode === 0,
    cancelled:     data.ResultCode === '1032',
  };
}

// Store pending STK pushes in memory for callback matching
const pendingStkPushes = new Map<string, { resolve: (ref: string) => void; reject: (err: Error) => void }>();

export function registerPending(checkoutRequestId: string, resolve: (ref: string) => void, reject: (err: Error) => void) {
  pendingStkPushes.set(checkoutRequestId, { resolve, reject });
  // Auto-expire after 90 seconds
  setTimeout(() => {
    if (pendingStkPushes.has(checkoutRequestId)) {
      pendingStkPushes.get(checkoutRequestId)?.reject(new Error('M-Pesa payment timed out'));
      pendingStkPushes.delete(checkoutRequestId);
    }
  }, 90000);
}

export function resolveCallback(checkoutRequestId: string, resultCode: number | string, mpesaReceiptNumber: string) {
  const entry = pendingStkPushes.get(checkoutRequestId);
  if (!entry) return;
  pendingStkPushes.delete(checkoutRequestId);
  if (resultCode === 0 || resultCode === '0') {
    entry.resolve(mpesaReceiptNumber);
  } else {
    entry.reject(new Error('M-Pesa payment failed or was cancelled'));
  }
}
