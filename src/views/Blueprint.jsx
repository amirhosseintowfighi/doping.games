import { useMemo, useState } from 'react';
import { ArrowLeft, Clock, Database, FileCode2, Fingerprint, Gauge, Globe, KeyRound, Lock, Repeat, Router, ScanLine, Server, ShieldCheck, UserCog } from 'lucide-react';
import { Badge, Card, CopyBtn, cx, Mono, SectionTitle } from '../ui.jsx';

// The tab renders the real backend sources from /backend, so what you read here is what ships.
import mikrotik from '../../backend/lib/mikrotik/MikroTikService.ts?raw';
import provisioning from '../../backend/lib/mikrotik/provisioning.ts?raw';
import worker from '../../backend/workers/quotaWorker.ts?raw';
import crypto from '../../backend/lib/crypto.ts?raw';
import guard from '../../backend/lib/security/guard.ts?raw';
import rateLimit from '../../backend/lib/security/rateLimit.ts?raw';
import schemas from '../../backend/lib/schemas.ts?raw';
import db from '../../backend/lib/db.ts?raw';
import login from '../../backend/app/api/auth/login/route.ts?raw';
import dns from '../../backend/app/api/dns/whitelist/route.ts?raw';
import pay from '../../backend/app/api/payments/zarinpal/callback/route.ts?raw';
import adminTraffic from '../../backend/app/api/admin/users/[id]/traffic/route.ts?raw';
import schema from '../../backend/db/schema.sql?raw';
import rsc from '../../backend/routeros/iran-edge.rsc?raw';

const FILES = [
  { group: 'MikroTik RouterOS v7', path: 'lib/mikrotik/MikroTikService.ts', code: mikrotik, note: 'کلاینت REST: ساخت Peer وایرگارد، Simple Queue، ریست شمارنده و address-list.' },
  { group: 'MikroTik RouterOS v7', path: 'lib/mikrotik/provisioning.ts', code: provisioning, note: 'تولید کلید Curve25519، تخصیص آی‌پی تانل و ساخت کانفیگ کاربر.' },
  { group: 'MikroTik RouterOS v7', path: 'workers/quotaWorker.ts', code: worker, note: 'هر ۵ دقیقه صف‌ها رو می‌خونه، مصرف رو جمع می‌زنه و با اتمام حجم Peer رو غیرفعال می‌کنه.' },
  { group: 'MikroTik RouterOS v7', path: 'routeros/iran-edge.rsc', code: rsc, note: 'اسکریپت پایه نود ورودی ایران: تانل، روتینگ، فایروال DNS و سخت‌سازی REST.' },
  { group: 'امنیت', path: 'lib/crypto.ts', code: crypto, note: 'AES-256-GCM با AAD و چرخش کلید، هش رمز با scrypt.' },
  { group: 'امنیت', path: 'lib/security/guard.ts', code: guard, note: 'نشست، RBAC، CSRF، Rate Limit و اعتبارسنجی Zod در یک wrapper.' },
  { group: 'امنیت', path: 'lib/security/rateLimit.ts', code: rateLimit, note: 'Sliding Window اتمی روی Redis با اسکریپت Lua.' },
  { group: 'امنیت', path: 'lib/schemas.ts', code: schemas, note: 'اسکیماهای Zod برای همه ورودی‌ها، شامل allow-list دستورهای RCON.' },
  { group: 'API Routes', path: 'app/api/auth/login/route.ts', code: login, note: 'ورود با محدودیت دوگانه (آی‌پی + حساب) و زمان پاسخ ثابت.' },
  { group: 'API Routes', path: 'app/api/dns/whitelist/route.ts', code: dns, note: 'ثبت آی‌پی فعلی کاربر در address-list فایروال.' },
  { group: 'API Routes', path: 'app/api/payments/zarinpal/callback/route.ts', code: pay, note: 'تایید پرداخت idempotent؛ اعتبار دقیقاً یک‌بار اعمال می‌شه.' },
  { group: 'API Routes', path: 'app/api/admin/users/[id]/traffic/route.ts', code: adminTraffic, note: 'عملیات ادمین روی حجم و Peer، فقط برای SUPER_ADMIN.' },
  { group: 'داده', path: 'lib/db.ts', code: db, note: 'Pool پستگرس، تراکنش و ثبت لاگ ممیزی.' },
  { group: 'داده', path: 'db/schema.sql', code: schema, note: 'جداول، قیدها و ایندکس‌های یکتایی که جلوی اعتبار تکراری رو می‌گیرن.' },
];

const KW = new Set('import export from const let var function async await return if else for of in new class extends implements interface type readonly private public static try catch finally throw typeof instanceof satisfies as switch case break continue default null undefined true false void this'.split(' '));
const SQL = new Set('CREATE TABLE EXTENSION IF NOT EXISTS PRIMARY KEY DEFAULT NULL UNIQUE CHECK REFERENCES ON DELETE CASCADE INDEX WHERE IN REVOKE UPDATE FROM PUBLIC GENERATED ALWAYS AS IDENTITY'.split(' '));
const TOKEN = /(\/\/[^\n]*|--[^\n]*|\/\*[\s\S]*?\*\/|^#[^\n]*)|(`(?:\\.|[^`\\])*`|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")|(\b\d[\d_]*(?:\.\d+)?n?\b)|([A-Za-z_$][\w$]*)/gm;

function highlight(code, lang) {
  const out = [];
  let last = 0;
  let key = 0;
  for (const m of code.matchAll(TOKEN)) {
    if (m.index > last) out.push(code.slice(last, m.index));
    const [text, comment, str, num, word] = m;
    let cls = null;
    if (comment) cls = (lang === 'ts' && (comment.startsWith('--') || comment.startsWith('#'))) || (lang === 'sql' && comment.startsWith('//')) ? null : 'text-zinc-500 italic';
    else if (str) cls = 'text-emerald-300';
    else if (num) cls = 'text-amber-300';
    else if (word && (lang === 'sql' ? SQL.has(word) : KW.has(word))) cls = 'text-[#ff5c63]';
    else if (word && /^[A-Z][A-Za-z0-9]+$/.test(word) && lang === 'ts') cls = 'text-sky-300';
    out.push(cls ? <span key={key++} className={cls}>{text}</span> : text);
    last = m.index + text.length;
  }
  out.push(code.slice(last));
  return out;
}

const FLOW = [
  { icon: Globe, title: 'گیمر', sub: 'WireGuard · DNS', mono: '5.160.x.x' },
  { icon: Router, title: 'نود ورودی ایران', sub: 'RouterOS v7 · Simple Queue', mono: 'THR-EDGE-01' },
  { icon: Lock, title: 'بک‌بون رمزشده', sub: 'WireGuard · Policy Routing', mono: '172.16.50.0/30' },
  { icon: Router, title: 'نود خروجی', sub: 'عمان · امارات · اروپا', mono: 'MCT-EXIT-01' },
  { icon: Server, title: 'سرور بازی', sub: 'Valve · Riot · EA', mono: '28 ms' },
];
const CONTROL = [
  { icon: Server, title: 'Next.js App Router', sub: 'API Routes + پنل', mono: 'guarded()' },
  { icon: Database, title: 'PostgreSQL', sub: 'اشتراک، پرداخت، ممیزی', mono: 'FOR UPDATE' },
  { icon: Gauge, title: 'Redis', sub: 'Rate Limit', mono: 'ZSET + Lua' },
  { icon: Clock, title: 'Quota Worker', sub: 'هر ۵ دقیقه', mono: '/rest/queue/simple' },
];
const DEFENSE = [
  { icon: KeyRound, title: 'رمزگذاری در حالت سکون', text: 'رمز API میکروتیک و کلید خصوصی WireGuard با AES-256-GCM ذخیره می‌شن. AAD هر رمز رو به ردیف خودش قفل می‌کنه و کلیدها قابل چرخش هستن.', file: 'lib/crypto.ts' },
  { icon: Gauge, title: 'Rate Limit پنجره لغزان', text: 'ورود ۵ بار در ۱۵ دقیقه (هم آی‌پی هم حساب)، ثبت آی‌پی ۶ بار در ساعت، وب‌هوک پرداخت ۳۰ بار در دقیقه. با قطع Redis، درخواست رد می‌شه.', file: 'lib/security/rateLimit.ts' },
  { icon: UserCog, title: 'RBAC', text: 'نقش‌های USER و SUPER_ADMIN در سطح wrapper بررسی می‌شن. تلاش غیرمجاز با سطح critical در لاگ ممیزی ثبت می‌شه.', file: 'lib/security/guard.ts' },
  { icon: Fingerprint, title: 'CSRF', text: 'کوکی‌های __Host- با SameSite=Strict، توکن double-submit وابسته به نشست و بررسی هدر Origin برای هر درخواست تغییردهنده.', file: 'lib/security/guard.ts' },
  { icon: ScanLine, title: 'اعتبارسنجی Zod', text: 'هیچ ورودی‌ای بدون اسکیما به هندلر نمی‌رسه. آی‌پی‌های داخلی برای DNS رد می‌شن و RCON فقط دستورهای allow-list رو قبول می‌کنه.', file: 'lib/schemas.ts' },
  { icon: Repeat, title: 'پرداخت Idempotent', text: 'قفل ردیف روی authority و قید یکتای ref_id؛ مبلغ از دیتابیس خودمون خونده می‌شه. callback تکراری هیچ حجمی اضافه نمی‌کنه.', file: 'app/api/payments/zarinpal/callback/route.ts' },
  { icon: ShieldCheck, title: 'اتصال امن به روتر', text: 'REST فقط روی TLS با گواهی پین‌شده، فقط از آی‌پی پنل و با حساب کم‌دسترسی. سرویس‌های api، www، telnet و ftp خاموشن.', file: 'routeros/iran-edge.rsc' },
];

function Node({ n }) {
  return (
    <div className="well flex min-w-0 flex-1 basis-36 flex-col items-center gap-1 rounded-2xl px-3 py-4 text-center">
      <n.icon className="size-5 text-brand2" />
      <div className="text-sm font-black">{n.title}</div>
      <div className="text-[11px] text-silver">{n.sub}</div>
      <Mono className="text-[11px] text-zinc-400">{n.mono}</Mono>
    </div>
  );
}

export default function Blueprint() {
  const [path, setPath] = useState(FILES[0].path);
  const file = FILES.find((f) => f.path === path);
  const lang = path.endsWith('.sql') ? 'sql' : path.endsWith('.rsc') ? 'rsc' : 'ts';
  const html = useMemo(() => highlight(file.code, lang), [file, lang]);
  const lines = file.code.split('\n').length;
  const groups = [...new Set(FILES.map((f) => f.group))];
  const open = (p) => { setPath(p); document.getElementById('code')?.scrollIntoView({ block: 'start' }); };

  return (
    <div className="gutter mx-auto max-w-6xl pt-10">
      <SectionTitle
                label="معماری بک‌اند و امنیت"
        title="نقشه فنی دوپینگ"
        desc="کد این بخش همون فایل‌های پوشه backend در مخزن پروژه‌ست: TypeScript برای Next.js App Router، PostgreSQL و Redis."
        action={<Badge tone="ok" icon={ShieldCheck}><Mono>tsc --strict</Mono> بدون خطا</Badge>}
      />

      <Card className="mt-10 overflow-hidden p-6">
        <div className="text-xs font-black text-silver">مسیر داده (Data Plane)</div>
        <div className="mt-3 flex flex-wrap items-stretch gap-2">
          {FLOW.map((n, i) => (
            <div key={n.title} className="flex min-w-0 flex-1 basis-36 items-center gap-2">
              <Node n={n} />
              {i < FLOW.length - 1 && <ArrowLeft className="hidden size-4 shrink-0 text-brand2 lg:block" />}
            </div>
          ))}
        </div>
        <div className="mt-5 text-xs font-black text-silver">مسیر کنترل (Control Plane) · فقط REST روی TLS به نودهای ورودی</div>
        <div className="mt-3 flex flex-wrap gap-2">{CONTROL.map((n) => <Node key={n.title} n={n} />)}</div>
      </Card>

      <h3 className="mt-14 text-xl font-black">دفاع در عمق</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DEFENSE.map((d) => (
          <button key={d.title} type="button" onClick={() => open(d.file)} className="glass group relative p-5 text-start transition-colors hover:border-edge">
            <div className="flex items-center gap-2.5 text-[15px] font-black"><d.icon className="size-4 text-brand2" />{d.title}</div>
            <p className="mt-2 text-xs leading-6 text-silver">{d.text}</p>
            <Mono className="mt-2 block truncate text-[11px] text-zinc-500 group-hover:text-brand2">{d.file}</Mono>
          </button>
        ))}
      </div>

      <div id="code" className="mt-8 grid scroll-mt-32 gap-4 lg:grid-cols-[280px_1fr]">
        <Card as="nav" className="p-3 lg:sticky lg:top-28 lg:self-start" aria-label="فایل‌های بک‌اند">
          {groups.map((g) => (
            <div key={g} className="mb-2">
              <div className="px-2 py-1.5 text-[11px] font-black text-silver">{g}</div>
              {FILES.filter((f) => f.group === g).map((f) => (
                <button
                  key={f.path}
                  type="button"
                  dir="ltr"
                  onClick={() => setPath(f.path)}
                  aria-current={path === f.path ? 'true' : undefined}
                  className={cx('mono flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition', path === f.path ? 'bg-white/10 text-white' : 'text-zinc-500 hover:bg-white/[0.03] hover:text-white')}
                >
                  <FileCode2 className="size-3.5 shrink-0" />
                  <span className="truncate">{f.path.split('/').slice(-2).join('/')}</span>
                </button>
              ))}
            </div>
          ))}
        </Card>

        <Card className="min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-white/8 px-4 py-3">
            <div className="min-w-0 flex-1">
              <Mono className="block truncate text-sm font-bold">backend/{file.path}</Mono>
              <div className="text-xs text-silver">{file.note}</div>
            </div>
            <Mono className="text-[11px] text-zinc-500">{lines} lines</Mono>
            <CopyBtn text={file.code} label="کپی کد" />
          </div>
          <div dir="ltr" className="max-h-[720px] overflow-auto bg-black/40">
            <pre className="mono flex min-w-max text-left text-[12px] leading-[1.7]">
              <span aria-hidden="true" className="sticky left-0 bg-[#08080b] py-4 pr-3 pl-4 text-right text-zinc-700 select-none">
                {Array.from({ length: lines }, (_, i) => i + 1).join('\n')}
              </span>
              <code className="block py-4 pr-6 text-zinc-200">{html}</code>
            </pre>
          </div>
        </Card>
      </div>
    </div>
  );
}
