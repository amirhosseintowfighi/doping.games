// Zarinpal payment gateway, REST v4. Amounts are sent in Rial (our prices are in Toman × 10).
// PAYMENT_MODE=test (the default without a merchant id) uses a local stand-in page instead of the bank,
// so the whole purchase flow can be exercised without real money.
import { randomBytes } from 'node:crypto';
import { env } from './env';

const BASE = { live: 'https://payment.zarinpal.com', sandbox: 'https://sandbox.zarinpal.com' } as const;

export type RequestResult = { authority: string; redirect: string };
export type VerifyResult = { ok: true; refId: string; cardPan?: string; already: boolean } | { ok: false; code: number; message: string };

async function post(path: string, body: unknown): Promise<{ data?: Record<string, unknown> | []; errors?: { code?: number; message?: string } | [] }> {
  const base = BASE[env.paymentMode === 'sandbox' ? 'sandbox' : 'live'];
  const res = await fetch(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  return res.json();
}

export async function requestPayment(p: { amountToman: number; callbackUrl: string; description: string; orderId: string; email?: string }): Promise<RequestResult> {
  if (env.paymentMode === 'test') {
    const authority = `TEST${randomBytes(12).toString('hex').toUpperCase()}`;
    return { authority, redirect: `/pay/test?authority=${authority}` };
  }
  const r = await post('/pg/v4/payment/request.json', {
    merchant_id: env.zarinpalMerchant,
    amount: p.amountToman * 10,
    currency: 'IRR',
    callback_url: p.callbackUrl,
    description: p.description.slice(0, 250),
    metadata: { order_id: p.orderId, ...(p.email ? { email: p.email } : {}) },
  });
  const data = (Array.isArray(r.data) ? {} : r.data ?? {}) as { code?: number; authority?: string };
  if (data.code !== 100 || !data.authority) {
    const e = Array.isArray(r.errors) ? {} : r.errors ?? {};
    throw new Error(`zarinpal request failed: ${e.code ?? data.code ?? '?'} ${e.message ?? ''}`.trim());
  }
  const base = BASE[env.paymentMode === 'sandbox' ? 'sandbox' : 'live'];
  return { authority: data.authority, redirect: `${base}/pg/StartPay/${data.authority}` };
}

export async function verifyPayment(p: { amountToman: number; authority: string }): Promise<VerifyResult> {
  if (env.paymentMode === 'test') {
    return { ok: true, refId: `T${Date.now().toString().slice(-9)}`, cardPan: '6037-99**-****-1234', already: false };
  }
  const r = await post('/pg/v4/payment/verify.json', { merchant_id: env.zarinpalMerchant, amount: p.amountToman * 10, authority: p.authority });
  const data = (Array.isArray(r.data) ? {} : r.data ?? {}) as { code?: number; ref_id?: number | string; card_pan?: string };
  if (data.code === 100 || data.code === 101) return { ok: true, refId: String(data.ref_id), cardPan: data.card_pan, already: data.code === 101 };
  const e = (Array.isArray(r.errors) ? {} : r.errors ?? {}) as { code?: number; message?: string };
  return { ok: false, code: Number(e.code ?? data.code ?? -1), message: e.message ?? 'verify failed' };
}
