import type { Metadata } from 'next';
import { and, eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { db, schema } from '@/lib/server/db';
import { env } from '@/lib/server/env';

export const metadata: Metadata = { title: 'درگاه آزمایشی | دوپینگ', robots: { index: false } };
export const dynamic = 'force-dynamic';

/** Stand-in for the bank page while PAYMENT_MODE=test (no merchant id configured). */
export default async function TestGateway({ searchParams }: { searchParams: Promise<{ authority?: string }> }) {
  if (env.paymentMode !== 'test') notFound();
  const { authority = '' } = await searchParams;
  const order = /^TEST[0-9A-F]{24}$/.test(authority)
    ? (await db.select().from(schema.orders).where(and(eq(schema.orders.gateway, 'zarinpal'), eq(schema.orders.authority, authority))).limit(1))[0]
    : null;
  if (!order) notFound();
  const back = (status: string) => `/api/pay/callback?Authority=${authority}&Status=${status}`;
  return (
    <div className="gutter mx-auto flex min-h-[60vh] max-w-md flex-col justify-center py-12">
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-4 text-sm leading-7 text-amber-200">
        درگاه آزمایشی: کلید پذیرنده زرین‌پال هنوز تنظیم نشده (<span className="mono">ZARINPAL_MERCHANT_ID</span>)، پس پولی جابه‌جا نمی‌شه. روند تایید، فعال‌سازی و ثبت فاکتور دقیقاً مثل پرداخت واقعیه.
      </div>
      <div className="mt-4 rounded-2xl border border-line bg-card p-6">
        <div className="text-sm text-zinc-500">پرداخت به دوپینگ</div>
        <div className="mt-1 font-black">{order.title}</div>
        <div className="mt-4 text-3xl font-black">{order.amount.toLocaleString('fa-IR')} <span className="text-sm font-normal text-zinc-500">تومان</span></div>
        <div className="mt-6 flex gap-2">
          <a href={back('OK')} className="flex-1 rounded-xl bg-brand py-3 text-center text-sm font-bold text-white">پرداخت موفق</a>
          <a href={back('NOK')} className="rounded-xl bg-white/[0.06] px-5 py-3 text-center text-sm font-bold">انصراف</a>
        </div>
      </div>
    </div>
  );
}
