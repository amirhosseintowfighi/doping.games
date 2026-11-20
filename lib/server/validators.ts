import { z } from 'zod';
import { isIPv4, isPrivate } from '@/src/data.js';

export const email = z.string().trim().toLowerCase().max(120).email('ایمیل معتبر نیست.');
export const username = z.string().trim().regex(/^[A-Za-z0-9_.-]{3,24}$/, 'نام کاربری ۳ تا ۲۴ حرف لاتین، عدد، نقطه، خط تیره یا زیرخط.');
export const password = z.string().min(8, 'رمز حداقل ۸ کاراکتر.').max(128, 'رمز خیلی طولانیه.');
export const publicIp = z.string().trim().refine(isIPv4, 'این آی‌پی معتبر نیست.').refine((ip) => !isPrivate(ip), 'آی‌پی داخلی قبول نیست؛ آی‌پی عمومی اینترنتت رو وارد کن.');
export const orderInput = z.discriminatedUnion('type', [
  z.object({ type: z.literal('plan'), kind: z.enum(['ping', 'dns', 'pro']), tier: z.union([z.number().int().positive(), z.literal('inf')]).optional(), slots: z.number().int().min(0).max(50).optional(), months: z.number().int().min(1).max(24), code: z.string().max(32).optional() }),
  z.object({ type: z.literal('renew'), code: z.string().max(32).optional() }),
  z.object({ type: z.literal('extra'), gb: z.number().int().positive() }),
  z.object({ type: z.literal('topup'), amount: z.number().int().positive() }),
]);
