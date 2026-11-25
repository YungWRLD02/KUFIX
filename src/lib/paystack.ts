import crypto from 'node:crypto';

const BASE_URL = 'https://api.paystack.co';

export function paystackSecretKey() {
  const key = (process.env.PAYSTACK_SECRET_KEY || '').trim();
  return key || null;
}

export function isPaystackConfigured() {
  return !!paystackSecretKey();
}

export class PaystackError extends Error {
  constructor(message: string, public status?: number, public body?: unknown) {
    super(message);
    this.name = 'PaystackError';
  }
}

async function request<T = unknown>(path: string, options: RequestInit = {}, timeoutMs = 20000): Promise<T> {
  const key = paystackSecretKey();
  if (!key) throw new PaystackError('Paystack is not configured');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${BASE_URL}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      signal: controller.signal,
    });
    const body = await response.text();
    let data: any = null;
    try { data = JSON.parse(body); } catch { data = { raw: body }; }
    if (!response.ok) throw new PaystackError(data?.message || `Paystack error ${response.status}`, response.status, data);
    if (data && data.status === false) throw new PaystackError(data.message || 'Paystack rejected the request', response.status, data);
    return data?.data as T;
  } catch (error) {
    if (error instanceof PaystackError) throw error;
    throw new PaystackError(error instanceof Error ? error.message : 'Paystack request failed');
  } finally {
    clearTimeout(timer);
  }
}

export function generateReference(kind: string) {
  return `kufix_${kind}_${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
}

/** Step 1 of a wallet deposit: create a Paystack transaction to redirect to. */
export async function initializeDeposit(input: { email: string; amountKobo: number; reference: string; callbackUrl: string; metadata: Record<string, unknown> }) {
  const data = await request<{ authorization_url: string; reference: string; access_code?: string; access_code_id?: string }>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email,
      amount: input.amountKobo,
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: input.metadata,
    }),
  });
  if (!data?.authorization_url) throw new PaystackError('Paystack did not return a checkout URL');
  return { authorizationUrl: data.authorization_url, reference: data.reference || input.reference };
}

/** Verify a transaction on either the callback or webhook path. */
export async function verifyTransaction(reference: string) {
  const data = await request<any>(`/transaction/verify/${encodeURIComponent(reference)}`);
  if (!data) throw new PaystackError('Paystack returned no transaction');
  return data as { reference: string; status: string; amount: number; currency: string; metadata?: Record<string, any>; channel?: string; paid_at?: string; created_at?: string };
}

/** Get the list of Nigerian banks so the name→code match can be authoritative. */
export async function listNigerianBanks() {
  const data = await request<any[]>(`/bank?country=nigeria`);
  return Array.isArray(data) ? (data as { code: string; name: string }[]) : [];
}

/** Validate an account number with Paystack before a payout is attempted. */
export async function resolveAccountNumber(accountNumber: string, bankCode: string) {
  return request<{ account_name: string } | null>(`/bank/resolve?account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`);
}

/** Create (or reuse) a transfer recipient for a bank account. */
export async function createTransferRecipient(input: { name: string; accountNumber: string; bankCode: string; currency?: string; description?: string }) {
  const data = await request<{ recipient_code: string }>('/transferrecipient', {
    method: 'POST',
    body: JSON.stringify({
      type: 'nuban',
      name: input.name,
      account_number: input.accountNumber,
      bank_code: input.bankCode,
      currency: input.currency || 'NGN',
      description: input.description,
    }),
  });
  if (!data?.recipient_code) throw new PaystackError('Paystack did not return a recipient code');
  return data.recipient_code;
}

/** Initiate a transfer from the Paystack balance (payout). */
export async function initiateTransfer(input: { recipientCode: string; amountKobo: number; reference: string; reason?: string }) {
  return request<{ status: string; reference: string; transfer_code?: string }>('/transfer', {
    method: 'POST',
    body: JSON.stringify({
      source: 'balance',
      amount: input.amountKobo,
      currency: 'NGN',
      recipient: input.recipientCode,
      reference: input.reference,
      reason: input.reason || 'KUFIX withdrawal',
    }),
  });
}

/** Check the status of a transfer. */
export async function verifyTransfer(reference: string) {
  const data = await request<any>(`/transfer/verify/${encodeURIComponent(reference)}`);
  return data as { reference: string; status: string; reason?: string };
}

function shouldFail(status: string) {
  return ['failed', 'reversed'].includes(status.toLowerCase());
}

export function isSuccessfulTransfer(status: string) {
  return ['success'].includes(status.toLowerCase());
}
export function isFailedTransfer(status: string) {
  return shouldFail(status);
}

export function verifyPaystackSignature(rawBody: string, signature: string, secret: string) {
  if (!signature || !secret) return false;
  const expected = crypto.createHmac('sha512', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(signature, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
