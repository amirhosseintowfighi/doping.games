import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, BadgePercent, Check, CircleCheck, Crosshair, Crown, Globe, Infinity as Inf, Map as MapIcon, Play, Radio, Rocket,
  Router, Search, Server, ShieldCheck, ShoppingCart, Signal, Swords, Timer, Users, Wallet, Zap,
} from 'lucide-react';
import { useStore } from '../store.jsx';
import { Badge, Btn, Card, CopyBtn, cx, Dot, Field, Modal, Mono, Progress, SectionTitle } from '../ui.jsx';
import { EXITS, fa, GAMES, GB, MODES, PLAN_NAME, priceOf, rint, tierLabel, TIERS, toman } from '../data.js';

/* ───────────────────────── Ping simulator ───────────────────────── */

function useCountTo(target, deps) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf;
    const step = (t) => {
      const k = Math.min(1, (t - start) / 900);
      const e = 1 - (1 - k) ** 3;
      const cur = Math.round(a + (target - a) * e);
      from.current = cur;
      setV(cur);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return v;
}

function RouteRow({ label, tone, ping, loss, jitter, max, sub }) {
  const good = tone === 'ok';
  return (
    <div className={cx('rounded-xl border p-4', good ? 'border-emerald-500/25 bg-emerald-500/[0.06]' : 'border-white/8 bg-white/[0.02]')}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-black">
          {good ? <Zap className="size-4 text-ok" /> : <Globe className="size-4 text-silver" />}
          {label}
        </div>
        <div className="flex items-baseline gap-1" dir="ltr">
          <span className={cx('mono text-3xl font-black sm:text-4xl', good ? 'text-ok' : ping > 100 ? 'text-brand2' : 'text-warn')}>{ping}</span>
          <span className="mono text-sm text-silver">ms</span>
        </div>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white/8" dir="ltr">
        <div className={cx('h-full rounded-full transition-[width] duration-500', good ? 'bg-ok' : 'bg-gradient-to-r from-warn to-brand2')} style={{ width: `${Math.min(100, (ping / max) * 100)}%` }} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-silver">
        <span>پکت لاس <Mono className={cx('font-bold', loss > 0 ? 'text-brand2' : 'text-ok')}>{loss}%</Mono></span>
        <span>جیتر <Mono className="font-bold text-white">±{jitter}ms</Mono></span>
        <span className="text-zinc-500">{sub}</span>
      </div>
    </div>
  );
}

function PingSimulator() {
  const { s, set } = useStore();
  const [gameId, setGameId] = useState('cs2');
  const [run, setRun] = useState(0);
  const game = GAMES.find((g) => g.id === gameId);
  const exit = EXITS.find((e) => e.id === s.exit);
  const [tPing, tLoss, tJit] = game.via[s.exit];
  const best = Object.entries(game.via).sort((a, b) => a[1][0] - b[1][0])[0][0];

  // Small live wobble so the numbers behave like a running measurement.
  const wobble = useMemo(() => ({ isp: rint(-6, 9), dp: rint(-1, 1) }), [s.tick, gameId, s.exit]); // eslint-disable-line react-hooks/exhaustive-deps
  const isp = useCountTo(game.isp[0] + wobble.isp, [gameId, wobble.isp]);
  const dp = useCountTo(tPing + wobble.dp, [gameId, s.exit, run, wobble.dp]);
  const saved = Math.round((1 - tPing / game.isp[0]) * 100);

  return (
    <Card red className="relative min-w-0 overflow-hidden p-4 shadow-2xl shadow-red-600/10 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-black"><Radio className="size-4 text-brand2" /> شبیه‌ساز پینگ</div>
        <Badge tone="ok"><Dot /> زنده</Badge>
      </div>

      <div className="mt-4 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="انتخاب بازی">
        {GAMES.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={g.id === gameId}
            onClick={() => setGameId(g.id)}
            className={cx('mono shrink-0 rounded-lg border px-3 py-1.5 text-xs font-bold transition', g.id === gameId ? 'border-brand2 bg-brand/20 text-white' : 'border-white/10 text-silver hover:text-white')}
          >
            {g.name}
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-col gap-3">
        <RouteRow label="اینترنت معمولی (ISP)" ping={isp} loss={game.isp[1]} jitter={game.isp[2]} max={190} sub="مسیر بین‌الملل اشتراکی" />
        <RouteRow label={`مسیر دوپینگ · ${exit.name}`} tone="ok" ping={dp} loss={tLoss} jitter={tJit} max={190} sub={`تانل WireGuard تهران ← ${exit.name}`} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-silver" aria-label="مسیر اتصال">
        {['شما', 'نود تهران', `خروجی ${exit.code}`, game.dc].map((hop, i, a) => (
          <span key={hop} className="flex items-center gap-2">
            <span className={cx('mono rounded-md border px-2 py-1', i === 1 || i === 2 ? 'border-brand/40 bg-brand/10 text-white' : 'border-white/10')}>{hop}</span>
            {i < a.length - 1 && <ArrowLeft className="size-3 text-brand2" />}
          </span>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-4">
        <div className="flex flex-wrap gap-1.5">
          {EXITS.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => { set({ exit: e.id }); setRun((r) => r + 1); }}
              className={cx('rounded-lg border px-2.5 py-1 text-xs font-bold transition', e.id === s.exit ? 'border-white/40 bg-white/10 text-white' : 'border-white/10 text-silver hover:text-white')}
            >
              {e.name}
              {e.id === best && <span className="ms-1 text-ok">★</span>}
            </button>
          ))}
        </div>
        <div className="text-sm font-black">
          <Mono className="text-xl text-ok">{saved}%</Mono> پینگ کمتر روی <Mono>{game.full}</Mono>
        </div>
      </div>
    </Card>
  );
}

function Hero({ go }) {
  const { s } = useStore();
  const online = s.servers.reduce((a, v) => a + v.players, 0);
  return (
    <section className="relative overflow-hidden border-b border-white/8">
      <div className="grid-bg absolute inset-0" />
      <div className="absolute -top-40 right-1/4 size-[520px] rounded-full bg-brand/20 blur-[140px]" />
      <div className="gutter relative mx-auto grid max-w-7xl grid-cols-1 items-center gap-10 py-12 lg:grid-cols-[1.05fr_1fr] lg:py-16">
        <div className="min-w-0">
          <Badge tone="brand" icon={Router}>MikroTik RouterOS v7 · WireGuard</Badge>
          <h1 className="mt-5 text-5xl leading-[1.15] font-black sm:text-6xl lg:text-7xl">
            پینگت رو <span className="text-brand-grad">دوپینگ</span> کن!
          </h1>
          <p className="mt-5 max-w-xl text-base text-silver sm:text-lg">
            تانل اختصاصی گیمینگ از نودهای لبه ایران تا خروجی عمان، امارات و اروپا. پینگ پایین، بدون پکت لاس، بدون تحریم.
            سرورهای CS2 خودمون هم داخل ایران با پینگ زیر <Mono className="font-bold text-white">15ms</Mono> منتظرتن.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Btn size="lg" icon={Rocket} onClick={() => document.getElementById('pricing')?.scrollIntoView()}>خرید سرویس</Btn>
            <Btn size="lg" variant="ghost" icon={Crosshair} onClick={() => document.getElementById('servers')?.scrollIntoView()}>سرورهای CS2</Btn>
          </div>
          <dl className="mt-9 grid max-w-xl grid-cols-3 gap-3">
            {[
              [<Mono key="a">28ms</Mono>, 'میانگین پینگ CS2'],
              [<Mono key="b">0%</Mono>, 'پکت لاس روی تانل'],
              [fa(online), 'گیمر آنلاین روی سرورها'],
            ].map(([v, l]) => (
              <div key={l} className="border-s-2 border-brand ps-3">
                <dt className="text-xs text-silver">{l}</dt>
                <dd className="text-2xl font-black">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <PingSimulator />
      </div>
    </section>
  );
}

/* ───────────────────────── Game servers hub ───────────────────────── */

const GAME_ICON = { CS2: Crosshair, Rust: Swords, Minecraft: Server };

function ServerCard({ v }) {
  const { toast } = useStore();
  const addr = `${v.host}:${v.port}`;
  const full = v.players >= v.max;
  const load = (v.players / v.max) * 100;
  const Icon = GAME_ICON[v.game];
  const steam = v.game !== 'Minecraft';
  return (
    <Card className="flex min-w-0 flex-col gap-4 p-4 transition hover:border-brand/40">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-brand2"><Icon className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <Mono className="block truncate text-sm font-bold">{v.name}</Mono>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge tone={v.status === 'online' ? 'ok' : 'bad'}>{v.status === 'online' ? 'آنلاین' : 'آفلاین'}</Badge>
            <Badge><Mono>{v.game}</Mono></Badge>
            {v.vip && <Badge tone="warn" icon={Crown}>VIP</Badge>}
          </div>
        </div>
        <div className="text-end">
          <Mono className={cx('text-xl font-black', v.ping <= 20 ? 'text-ok' : 'text-warn')}>{v.ping}<span className="text-xs text-silver">ms</span></Mono>
          <div className="text-[10px] text-zinc-500">نود داخلی ایران</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-2"><MapIcon className="size-3.5 shrink-0 text-silver" /><Mono className="truncate font-bold">{v.map}</Mono></div>
        <div className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-2.5 py-2"><Signal className="size-3.5 shrink-0 text-silver" /><Mono className="truncate">{v.tick}</Mono></div>
      </div>

      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-silver"><Users className="size-3.5" /> بازیکن‌ها</span>
          <Mono className="font-bold">{v.players}/{v.max} Players</Mono>
        </div>
        <Progress value={load} />
      </div>

      <div className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-ink/60 py-1 ps-3 pe-1">
        <Mono className="truncate text-xs text-silver">{addr}</Mono>
        <CopyBtn text={steam ? `connect ${addr}` : addr} label="کپی IP" />
      </div>

      <div className="mt-auto flex items-center justify-between gap-2">
        <Badge tone="ok" icon={ShieldCheck}><Mono>{v.ac}</Mono></Badge>
        {steam ? (
          <a
            href={`steam://connect/${addr}`}
            onClick={() => toast(full ? 'سرور پره؛ با اسلات رزرو VIP وارد می‌شی.' : 'درخواست اتصال به Steam فرستاده شد.', full ? 'warn' : 'ok')}
            className="bg-brand-grad inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-xs font-black shadow-lg shadow-red-600/25 transition hover:brightness-110 active:scale-[0.97]"
          >
            <Play className="size-3.5 fill-current" /> اتصال سریع <Mono className="font-normal opacity-80">Steam</Mono>
          </a>
        ) : (
          <CopyBtn text={addr} label="کپی آدرس سرور" variant="primary" />
        )}
      </div>
    </Card>
  );
}

function ServersHub() {
  const { s } = useStore();
  const [mode, setMode] = useState('all');
  const [q, setQ] = useState('');
  const [onlyFree, setOnlyFree] = useState(false);
  const list = s.servers
    .filter((v) => mode === 'all' || v.mode === mode)
    .filter((v) => !onlyFree || v.players < v.max)
    .filter((v) => `${v.name} ${v.map}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => b.players / b.max - a.players / a.max);
  const count = (id) => s.servers.filter((v) => id === 'all' || v.mode === id).length;

  return (
    <section id="servers" className="gutter mx-auto max-w-7xl scroll-mt-28 py-14">
      <SectionTitle
        kicker="سرورهای بازی دوپینگ"
        title="بپر تو سرور، همین الان"
        desc="سرورهای اختصاصی CS2 روی نود داخلی ایران با Sub-tick، آنتی‌چیت و پینگ زیر ۱۵. برای اتصال، Steam باید روی سیستمت باز باشه."
        action={<Badge tone="ok"><Dot /> {fa(s.servers.filter((v) => v.status === 'online').length)} سرور آنلاین</Badge>}
      />
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              aria-pressed={mode === m.id}
              className={cx('shrink-0 rounded-xl border px-3.5 py-2 text-xs font-bold whitespace-nowrap transition', mode === m.id ? 'border-brand2 bg-brand/20 text-white' : 'border-white/10 bg-card text-silver hover:text-white')}
            >
              {m.label} <Mono className="ms-1 opacity-60">{count(m.id)}</Mono>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-silver">
          <input id="srv-free" type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} className="size-4 accent-[#e60012]" />
          فقط جای خالی
        </label>
        <div className="relative w-full sm:w-64">
          <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-zinc-500" />
          <input id="srv-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسم سرور یا مپ…" className="field pr-9" />
        </div>
      </div>
      {list.length ? (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{list.map((v) => <ServerCard key={v.id} v={v} />)}</div>
      ) : (
        <Card className="mt-6 p-10 text-center text-sm text-silver">سروری با این فیلتر پیدا نشد. فیلتر رو عوض کن.</Card>
      )}
    </section>
  );
}

/* ───────────────────────── Pricing & checkout ───────────────────────── */

const KINDS = [
  { id: 'ping', label: 'سرویس کاهش پینگ', icon: Zap, feats: ['تانل WireGuard اختصاصی', 'انتخاب خروجی عمان / امارات / اروپا', 'کانفیگ برای ویندوز، موبایل و روتر', 'نمایش لحظه‌ای حجم مصرفی'] },
  { id: 'dns', label: 'دی‌ان‌اس ضد تحریم', icon: Globe, feats: ['رفع تحریم Steam، Riot، EA، Battle.net', 'ثبت آی‌پی با یک کلیک', 'بدون افت سرعت دانلود', 'مناسب کنسول و PC'] },
  { id: 'pro', label: 'پکیج پرو', icon: Crown, feats: ['همه امکانات کاهش پینگ', 'DNS ضد تحریم با ۲ آی‌پی', 'اسلات رزرو و تگ VIP روی سرورهای CS2', 'اولویت در پشتیبانی'] },
];
const SLOTS = [1, 2, 3, 5];
const STEPS = ['انتقال به درگاه و پرداخت', 'تایید تراکنش (verify)', 'ساخت Peer و Simple Queue در میکروتیک'];

function Checkout({ order, onClose, go }) {
  const { s, set, toast, log, invoice, patch } = useStore();
  const gateways = s.gateways.filter((g) => g.enabled);
  const [gw, setGw] = useState('wallet');
  const [code, setCode] = useState('');
  const [applied, setApplied] = useState(null);
  const [codeErr, setCodeErr] = useState('');
  const [step, setStep] = useState(-1);
  const total = Math.round((order.total * (1 - (applied?.percent ?? 0) / 100)) / 1000) * 1000;
  const walletShort = gw === 'wallet' && s.wallet < total;
  const done = step >= STEPS.length;

  const applyCode = () => {
    const d = s.discounts.find((x) => x.code === code.trim().toUpperCase());
    if (!d) return setCodeErr('این کد وجود نداره.');
    if (!d.active || d.used >= d.max) return setCodeErr('این کد منقضی شده یا ظرفیتش پر شده.');
    setCodeErr('');
    setApplied(d);
  };

  const pay = () => {
    setStep(0);
    const gwName = gw === 'wallet' ? 'کیف پول' : gateways.find((g) => g.id === gw).name;
    setTimeout(() => setStep(1), 900);
    setTimeout(() => setStep(2), 1700);
    setTimeout(() => {
      if (gw === 'wallet') set((p) => ({ wallet: p.wallet - total }));
      if (applied) set((p) => ({ discounts: p.discounts.map((d) => (d.id === applied.id ? { ...d, used: d.used + 1 } : d)) }));
      invoice(order.title, total, gwName);
      log('payment', 'info', `${gw} verify OK · ${order.title} · ${total.toLocaleString('en-US')} T`, 'Arash_AWP', '5.160.14.92');
      if (order.kind === 'dns') {
        set({ dnsSlots: order.slots });
      } else {
        patch('users', 'u1', (u) => ({
          plan: order.kind, quota: order.tier === 'inf' ? null : order.tier * GB, up: 0, down: 0,
          expires: Math.max(u.expires, Date.now()) + order.months * 30 * 86_400_000, status: 'active', peer: true, online: true,
        }));
        if (order.kind === 'pro') set((p) => ({ dnsSlots: Math.max(p.dnsSlots, 2) }));
        log('mikrotik', 'info', 'POST /rest/queue/simple/reset-counters + PATCH peer disabled=false · Arash_AWP', 'panel', '10.0.0.4');
      }
      setStep(3);
      toast('پرداخت تایید شد و سرویس فعاله.');
    }, 2700);
  };

  return (
    <Modal
      open
      onClose={step >= 0 && !done ? () => {} : onClose}
      title={done ? 'سرویس فعال شد' : 'تسویه سفارش'}
      icon={done ? CircleCheck : ShoppingCart}
      footer={
        done ? (
          <>
            <Btn variant="ghost" onClick={onClose}>بستن</Btn>
            <Btn icon={ArrowLeft} onClick={() => { onClose(); go('panel'); }}>برو به پنل و کانفیگ رو بگیر</Btn>
          </>
        ) : (
          <>
            <Btn variant="ghost" onClick={onClose} disabled={step >= 0}>انصراف</Btn>
            <Btn onClick={pay} busy={step >= 0} disabled={walletShort}>پرداخت {toman(total)}</Btn>
          </>
        )
      }
    >
      <div className="rounded-xl border border-white/8 bg-white/[0.03] p-4">
        <div className="text-sm font-black">{order.title}</div>
        <dl className="mt-3 space-y-1.5 text-sm">
          <div className="flex justify-between text-silver"><dt>قیمت پایه</dt><dd>{toman(order.gross)}</dd></div>
          {order.off > 0 && <div className="flex justify-between text-ok"><dt>تخفیف {fa(order.months)} ماهه</dt><dd>{fa(order.off)}٪</dd></div>}
          {applied && <div className="flex justify-between text-ok"><dt>کد <Mono>{applied.code}</Mono></dt><dd>{fa(applied.percent)}٪</dd></div>}
          <div className="flex justify-between border-t border-white/8 pt-2 text-base font-black"><dt>مبلغ نهایی</dt><dd>{toman(total)}</dd></div>
        </dl>
      </div>

      {step < 0 ? (
        <>
          <div className="mt-4 flex items-end gap-2">
            <Field label="کد تخفیف" error={codeErr} className="flex-1">
              <input id="co-code" dir="ltr" value={code} onChange={(e) => setCode(e.target.value)} placeholder="DOPING20" className="field mono uppercase" />
            </Field>
            <Btn variant="ghost" icon={BadgePercent} onClick={applyCode} className={codeErr ? 'mb-6' : ''}>اعمال</Btn>
          </div>
          <div className="mt-4 text-xs font-bold text-silver">روش پرداخت</div>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {[{ id: 'wallet', name: 'کیف پول', kind: `موجودی ${toman(s.wallet)}` }, ...gateways].map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setGw(g.id)}
                aria-pressed={gw === g.id}
                className={cx('flex items-center gap-3 rounded-xl border p-3 text-start transition', gw === g.id ? 'border-brand2 bg-brand/15' : 'border-white/10 hover:border-white/25')}
              >
                {g.id === 'wallet' ? <Wallet className="size-5 text-brand2" /> : <ShieldCheck className="size-5 text-silver" />}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-bold">{g.name}</span>
                  <span className="block truncate text-[11px] text-silver">{g.kind}</span>
                </span>
              </button>
            ))}
          </div>
          {walletShort && <p className="mt-3 text-xs text-warn">موجودی کیف پول کمه. یه درگاه دیگه انتخاب کن یا از پنل کیف پولت رو شارژ کن.</p>}
        </>
      ) : (
        <ol className="mt-5 space-y-3">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-3 text-sm">
              <span className={cx('grid size-6 place-items-center rounded-full border text-xs', step > i ? 'border-ok bg-ok/20 text-ok' : step === i ? 'border-brand2 text-brand2' : 'border-white/15 text-zinc-600')}>
                {step > i ? <Check className="size-3.5" /> : step === i ? <span className="size-3 animate-spin rounded-full border-2 border-brand2/30 border-t-brand2" /> : i + 1}
              </span>
              <span className={step >= i ? 'font-bold' : 'text-zinc-500'}>{label}</span>
            </li>
          ))}
        </ol>
      )}
    </Modal>
  );
}

function Pricing({ go }) {
  const { s } = useStore();
  const [kind, setKind] = useState('ping');
  const [ti, setTi] = useState(1);
  const [si, setSi] = useState(0);
  const [months, setMonths] = useState(1);
  const [order, setOrder] = useState(null);
  const K = KINDS.find((k) => k.id === kind);
  const tier = TIERS[ti];
  const slots = SLOTS[si];
  const p = priceOf(s.pricing, { kind, tier, slots, months });
  const isDns = kind === 'dns';
  const idx = isDns ? si : ti;
  const steps = isDns ? SLOTS : TIERS;
  const title = isDns
    ? `DNS ضد تحریم · ${fa(slots)} آی‌پی · ${fa(months)} ماهه`
    : `${PLAN_NAME[kind]} · ${tierLabel(tier)} · ${fa(months)} ماهه`;

  return (
    <section id="pricing" className="gutter mx-auto max-w-7xl scroll-mt-28 py-14">
      <SectionTitle kicker="فروشگاه سرویس‌ها" title="پلنت رو خودت بساز" desc="حجم و مدت رو انتخاب کن؛ قیمت همون لحظه حساب می‌شه. فعال‌سازی آنی، بدون قرارداد." />
      <div className="mt-6 grid gap-2 sm:grid-cols-3">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id)}
            aria-pressed={kind === k.id}
            className={cx('flex items-center gap-3 rounded-2xl border p-4 text-start transition', kind === k.id ? 'glass-red shadow-lg shadow-red-600/15' : 'border-white/8 bg-card hover:border-white/20')}
          >
            <span className={cx('grid size-10 shrink-0 place-items-center rounded-xl', kind === k.id ? 'bg-brand-grad' : 'bg-white/5 text-silver')}><k.icon className="size-5" /></span>
            <span className="min-w-0">
              <span className="block truncate font-black">{k.label}</span>
              <span className="block truncate text-xs text-silver">{k.id === 'ping' ? 'حجمی / زمانی' : k.id === 'dns' ? 'بر اساس تعداد آی‌پی' : 'کاهش پینگ + DNS + VIP سرورهای CS2'}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-black">{isDns ? 'تعداد آی‌پی مجاز' : 'حجم ترافیک ماهانه'}</div>
            {!isDns && (tier === 'inf' ? <Badge tone="brand" icon={Inf}>زمانی · بدون سقف حجم</Badge> : <Badge icon={Timer}>حجمی</Badge>)}
          </div>
          <div className="mt-2 text-4xl font-black">
            {isDns ? <>{fa(slots)} <span className="text-lg text-silver">آی‌پی</span></> : tier === 'inf' ? 'نامحدود' : <><Mono>{tier}</Mono> <Mono className="text-lg text-silver">GB</Mono></>}
          </div>
          <div className="relative mt-6">
            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/10" dir="ltr">
              <div className="bg-brand-grad h-full rounded-full" style={{ width: `${(idx / (steps.length - 1)) * 100}%` }} />
            </div>
            <input
              id="plan-slider"
              type="range"
              className="slider relative block"
              min={0}
              max={steps.length - 1}
              step={1}
              value={idx}
              onChange={(e) => (isDns ? setSi(+e.target.value) : setTi(+e.target.value))}
              aria-label={isDns ? 'تعداد آی‌پی' : 'حجم ترافیک'}
              aria-valuetext={isDns ? `${slots} آی‌پی` : tierLabel(tier)}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-silver" dir="ltr">
            {steps.map((t, i) => (
              <button key={t} type="button" onClick={() => (isDns ? setSi(i) : setTi(i))} className={cx('mono rounded px-1', i === idx && 'font-bold text-white')}>
                {t === 'inf' ? '∞' : isDns ? `${t} IP` : `${t} GB`}
              </button>
            ))}
          </div>

          <div className="mt-7 text-sm font-black">مدت اشتراک</div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {[1, 3, 6].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMonths(m)}
                aria-pressed={months === m}
                className={cx('rounded-xl border px-2 py-3 text-center transition', months === m ? 'border-brand2 bg-brand/15' : 'border-white/10 hover:border-white/25')}
              >
                <div className="font-black">{fa(m)} ماهه</div>
                <div className={cx('text-[11px]', s.pricing.dur[m] ? 'text-ok' : 'text-zinc-500')}>{s.pricing.dur[m] ? `${fa(s.pricing.dur[m])}٪ تخفیف` : 'قیمت پایه'}</div>
              </button>
            ))}
          </div>
        </Card>

        <Card red className="flex flex-col p-5 sm:p-6">
          <div className="flex items-center gap-2 text-sm font-black"><K.icon className="size-4 text-brand2" /> {K.label}</div>
          <ul className="mt-4 space-y-2 text-sm text-zinc-300">
            {K.feats.map((f) => <li key={f} className="flex items-start gap-2"><Check className="mt-1 size-4 shrink-0 text-ok" />{f}</li>)}
          </ul>
          <div className="mt-auto pt-6">
            {p.off > 0 && <div className="text-sm text-zinc-500 line-through">{toman(p.gross)}</div>}
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-4xl font-black">{fa(p.total)}</span>
              <span className="text-silver">تومان</span>
            </div>
            <div className="mt-1 text-xs text-silver">معادل ماهی {toman(Math.round(p.total / months / 1000) * 1000)}</div>
            <Btn size="lg" icon={ShoppingCart} className="mt-4 w-full" onClick={() => setOrder({ kind, tier, slots, months, title, ...p })}>خرید و فعال‌سازی آنی</Btn>
          </div>
        </Card>
      </div>
      {order && <Checkout order={order} onClose={() => setOrder(null)} go={go} />}
    </section>
  );
}

export default function Storefront({ go }) {
  return (
    <>
      <Hero go={go} />
      <ServersHub />
      <Pricing go={go} />
    </>
  );
}
