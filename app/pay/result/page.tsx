import type { Metadata } from 'next';
import Link from 'next/link';
import { and, eq } from 'drizzle-orm';
import { CircleAlert, CircleCheck } from 'lucide-react';
import { currentUser } from '@/lib/server/auth';
import { db, schema } from '@/lib/server/db';

export const metadata: Metadata = { title: 'نتیجه پرداخت | دوپینگ', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function PayResult({ searchParams }: { searchParams: Promise<{ ok?: string; order?: string; msg?: string }> }) {
  const p = await searchParams;
  const user = await currentUser();
  const order = user && p.order && /^[0-9a-f-]{36}$/.test(p.order)
    ? (await db.select().from(schema.orders).where(and(eq(schema.orders.id, p.order), eq(schema.orders.userId, user.id))).limit(1))[0]
    : null;
  const ok = order ? order.status === 'paid' : p.ok === '1';
  return (
    <div className="gutter mx-auto flex min-h-[60vh] max-w-lg flex-col justify-center py-12 text-center">
      {ok ? <CircleCheck className="mx-auto size-14 text-ok" /> : <CircleAlert className="mx-auto size-14 text-brand2" />}
      <h1 className="mt-4 text-2xl font-black">{ok ? 'پرداخت موفق بود' : 'پرداخت انجام نشد'}</h1>
      <p className="mt-2 text-sm leading-7 text-zinc-400">{ok ? 'سرویست همین الان فعال شد.' : p.msg ?? 'اگه مبلغی از حسابت کم شده، حداکثر تا ۷۲ ساعت برمی‌گرده.'}</p>
      {order && (
        <dl className="mx-auto mt-6 w-full space-y-2 rounded-2xl border border-line bg-card p-5 text-start text-sm">
          <div className="flex justify-between gap-4"><dt className="text-zinc-500">فاکتور</dt><dd className="mono">INV-{order.number}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-zinc-500">شرح</dt><dd>{order.title}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-zinc-500">مبلغ</dt><dd>{order.amount.toLocaleString('fa-IR')} تومان</dd></div>
          {order.refId && <div className="flex justify-between gap-4"><dt className="text-zinc-500">کد پیگیری</dt><dd className="mono">{order.refId}</dd></div>}
        </dl>
      )}
      <div className="mt-6 flex justify-center gap-2">
        <Link href={order?.type === 'topup' ? '/panel?tab=billing' : '/panel'} className="rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-black">برو به پنل</Link>
        {!ok && <Link href="/#pricing" className="rounded-xl bg-white/[0.06] px-5 py-2.5 text-sm font-bold">تلاش دوباره</Link>}
      </div>
    </div>
  );
}
