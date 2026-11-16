import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BadgePercent, Check, CircleCheck, Crown, Globe, Play, Search, ShieldCheck, ShoppingCart, Wallet, Zap } from 'lucide-react';
import { useStore } from '../store.jsx';
import { ModeEmblem, PingBars, Pips, RouteMap, SpeedBars } from '../art.jsx';
import { Badge, Btn, Card, CopyBtn, cx, Dot, Field, Modal, Mono, SectionTitle } from '../ui.jsx';
import { EXITS, fa, GAMES, GB, MODES, PLAN_NAME, priceOf, rint, tierLabel, TIERS, toman } from '../data.js';

/* ───────────────────────── Hero ───────────────────────── */

function useCountTo(target, deps) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = performance.now();
    const a = from.current;
    let raf;
    const step = (t) => {
      const k = Math.min(1, (t - start) / 900);
      const cur = Math.round(a + (target - a) * (1 - (1 - k) ** 3));
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

const chip = (on) => cx('para shrink-0 px-3.5 py-1.5 text-xs font-bold whitespace-nowrap transition-colors duration-150', on ? 'bg-white text-black' : 'text-zinc-400 hover:text-white');

function Hero() {
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
  const jump = (id) => document.getElementById(id)?.scrollIntoView();
  const rows = [
    { name: 'اینترنت معمولی', sub: 'مسیر اشتراکی بین‌الملل', ping: isp, loss: game.isp[1], jit: game.isp[2], hops: 14 },
    { name: `دوپینگ از ${exit.name}`, sub: 'تانل WireGuard اختصاصی', ping: dp, loss: tLoss, jit: tJit, hops: 3, win: true },
  ];

  return (
    <section className="relative overflow-hidden">
      <SpeedBars className="absolute top-[clamp(5.2rem,14vw,11rem)] left-0 w-[62%] sm:w-[54%]" />

      <div className="gutter relative mx-auto max-w-7xl pt-12 sm:pt-20">
        <h1 className="text-[clamp(3.6rem,13vw,10.5rem)] leading-[1.02] font-black">
          <span className="sliced inline-block">پینگت رو</span>
          <br />
          <span className="para inline-block bg-white px-[0.18em] text-black"><span className="inline-block">دوپینگ</span></span> کن!
        </h1>
        <div className="mt-8 grid grid-cols-1 items-end gap-8 lg:grid-cols-[minmax(0,30rem)_1fr]">
          <div>
            <p className="text-lg leading-9 text-zinc-300">
              تانل اختصاصی گیمینگ از لبه ایران تا عمان، امارات و اروپا. پینگ پایین، بدون پکت لاس، بدون تحریم.
            </p>
            <div className="mt-7 flex flex-wrap gap-4 ps-2">
              <Btn size="lg" onClick={() => jump('pricing')}>خرید سرویس</Btn>
              <Btn size="lg" variant="ghost" onClick={() => jump('servers')}>سرورهای CS2</Btn>
            </div>
          </div>
        </div>

        {/* The glass sits on top of the trail so the bars show through it. */}
        <Card className="mt-12 sm:mt-16">
          <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 px-5 pt-6 sm:px-8">
            <div className="flex items-center gap-2.5 text-sm font-black"><Dot /> مسیر زنده تا <Mono>{game.dc}</Mono></div>
            <div className="flex max-w-full gap-1 overflow-x-auto px-1" role="tablist" aria-label="انتخاب بازی">
              {GAMES.map((g) => (
                <button key={g.id} type="button" role="tab" aria-selected={g.id === gameId} onClick={() => setGameId(g.id)} className={chip(g.id === gameId)}><Mono className="block">{g.name}</Mono></button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto"><RouteMap exit={s.exit} dcLabel={game.dc} className="mt-2 block w-full min-w-[640px]" /></div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 sm:px-8">
            <span className="text-xs font-bold text-zinc-400">خروجی</span>
            <div className="flex gap-1 px-1">
              {EXITS.map((e) => (
                <button key={e.id} type="button" aria-pressed={e.id === s.exit} onClick={() => { set({ exit: e.id }); setRun((r) => r + 1); }} className={chip(e.id === s.exit)}>
                  <span className="block">{e.name}{e.id === best && ' ★'}</span>
                </button>
              ))}
            </div>
          </div>

          {/* timing sheet */}
          <div className="mt-5 overflow-x-auto px-5 pb-8 sm:px-8">
            <table className="w-full min-w-[520px] text-start">
              <thead>
                <tr className="text-xs text-zinc-500">
                  {['مسیر', 'پینگ', 'پکت لاس', 'جیتر', 'هاپ'].map((h) => <th key={h} className="pb-2 text-start font-bold">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.name} className={cx('border-t', r.win ? 'border-brand bg-brand text-white' : 'border-white/15 text-zinc-400')}>
                    <td className="py-3 ps-4">
                      <div className={cx('text-base font-black', r.win && 'text-white')}>{r.name}</div>
                      <div className={cx('text-xs', r.win ? 'text-white/75' : 'text-zinc-500')}>{r.sub}</div>
                    </td>
                    <td className="py-3"><Mono className="text-4xl font-black italic sm:text-5xl">{r.ping}</Mono><Mono className="ms-1 text-xs">ms</Mono></td>
                    <td className="py-3"><Mono className="text-xl font-black italic">{r.loss}%</Mono></td>
                    <td className="py-3"><Mono className="text-xl font-black italic">±{r.jit}</Mono></td>
                    <td className="py-3 pe-4"><Mono className="text-xl font-black italic">{r.hops}</Mono></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-sm text-zinc-300">
              <Mono className="text-2xl font-black text-white italic">−{Math.max(0, isp - dp)}ms</Mono>
              <span className="ms-3">اختلاف پینگ روی <Mono>{game.full}</Mono></span>
            </p>
          </div>
        </Card>
      </div>
    </section>
  );
}

/* ───────────────────────── Game servers: a timing board, not a card grid ───────────────────────── */

function ServerRow({ v }) {
  const { toast } = useStore();
  const addr = `${v.host}:${v.port}`;
  const full = v.players >= v.max;
  const on = v.status === 'online';
  const steam = v.game !== 'Minecraft';
  return (
    <li className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 border-t border-white/10 px-4 py-4 transition-colors duration-150 hover:bg-white/[0.06] sm:px-6 lg:grid-cols-[auto_minmax(0,1.5fr)_minmax(0,1fr)_11rem_5rem_auto]">
      <ModeEmblem mode={v.mode} vip={v.vip} className="h-11 w-auto" />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Mono className="truncate text-[15px] font-bold">{v.name}</Mono>
          {v.vip && <Crown className="size-4 shrink-0 text-warn" aria-label="VIP" />}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs text-zinc-500">
          <Mono>{v.tick}</Mono>
          <span className="inline-flex items-center gap-1 text-emerald-400"><ShieldCheck className="size-3.5" /><Mono>{v.ac}</Mono></span>
          {!on && <span className="font-bold text-brand2">آفلاین</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 lg:hidden" dir="ltr">
        <PingBars ping={on ? v.ping : 999} /><Mono className="text-lg font-black italic">{on ? v.ping : '—'}</Mono>
      </div>

      <Mono className="col-span-3 truncate text-2xl font-black italic lg:col-span-1">{v.map}</Mono>
      <div className="col-span-3 lg:col-span-1">
        <div className="mb-1.5 flex items-baseline justify-between" dir="ltr">
          <Mono className="text-sm"><b className="text-lg font-black italic">{v.players}</b><span className="text-zinc-500">/{v.max} Players</span></Mono>
          {full && <span className="text-xs font-bold text-brand2">پر</span>}
        </div>
        <Pips value={v.players} max={v.max} />
      </div>
      <div className="hidden items-center gap-2 lg:flex" dir="ltr">
        <PingBars ping={on ? v.ping : 999} /><Mono className="text-2xl font-black italic">{on ? v.ping : '—'}</Mono><Mono className="text-xs text-zinc-500">ms</Mono>
      </div>
      <div className="col-span-3 flex flex-wrap items-center justify-end gap-3 ps-2 lg:col-span-1">
        <CopyBtn text={steam ? `connect ${addr}` : addr} label="کپی IP" size="md" />
        {steam ? (
          <a
            href={`steam://connect/${addr}`}
            onClick={() => toast(full ? 'سرور پره؛ با اسلات رزرو VIP وارد می‌شی.' : 'درخواست اتصال به Steam فرستاده شد.', full ? 'warn' : 'ok')}
            className="para inline-flex h-10 items-center bg-brand px-5 text-[13px] font-black whitespace-nowrap transition-colors duration-150 hover:bg-white hover:text-black"
          >
            <span className="inline-flex items-center gap-2"><Play className="size-3.5 fill-current" /> اتصال سریع <Mono className="font-normal opacity-80">(Steam Connect)</Mono></span>
          </a>
        ) : (
          <CopyBtn text={addr} label="کپی آدرس سرور" variant="primary" size="md" />
        )}
      </div>
    </li>
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
    <section id="servers" className="gutter mx-auto max-w-7xl scroll-mt-24 pt-28">
      <SectionTitle
        title="بپر تو سرور"
        desc="سرورهای اختصاصی CS2 روی نود داخلی ایران با Sub-tick، آنتی‌چیت و پینگ زیر ۱۵. برای اتصال، Steam باید روی سیستمت باز باشه."
        action={<Badge tone="ok">{fa(s.servers.filter((v) => v.status === 'online').length)} سرور آنلاین · {fa(s.servers.reduce((a, v) => a + v.players, 0))} بازیکن</Badge>}
      />
      <div className="mt-10 flex flex-wrap items-center gap-x-5 gap-y-3">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto px-1">
          {MODES.map((m) => (
            <button key={m.id} type="button" onClick={() => setMode(m.id)} aria-pressed={mode === m.id} className={chip(mode === m.id)}>
              <span className="block">{m.label} <Mono className="opacity-50">{count(m.id)}</Mono></span>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs font-bold text-zinc-400">
          <input id="srv-free" type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} className="size-4 accent-[#e60012]" />
          فقط جای خالی
        </label>
        <div className="relative w-full sm:w-64">
          <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-zinc-500" />
          <input id="srv-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسم سرور یا مپ…" className="field pr-9" />
        </div>
      </div>
      <Card className="mt-6">
        <div className="hidden grid-cols-[auto_minmax(0,1.5fr)_minmax(0,1fr)_11rem_5rem_auto] gap-x-4 px-6 pt-5 pb-3 text-xs font-bold text-zinc-500 lg:grid">
          <span className="w-[3.25rem]" /><span>سرور</span><span>مپ</span><span>بازیکن‌ها</span><span>پینگ داخلی</span><span className="w-[21rem]" />
        </div>
        {list.length ? <ul>{list.map((v) => <ServerRow key={v.id} v={v} />)}</ul> : <p className="p-12 text-center text-sm text-zinc-400">سروری با این فیلتر پیدا نشد. فیلتر رو عوض کن.</p>}
        <div className="h-5" />
      </Card>
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
      <div className="well p-5">
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
                className={cx('relative flex items-center gap-3 rounded-2xl p-3.5 text-start transition', gw === g.id ? 'glass-red' : 'well hover:bg-white/[0.04]')} style={{ '--cut': '10px' }}
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
    <section id="pricing" className="gutter mx-auto max-w-7xl scroll-mt-28 pt-28">
      <SectionTitle title="پلنت رو بساز" desc="حجم و مدت رو انتخاب کن؛ قیمت همون لحظه حساب می‌شه. فعال‌سازی آنی، بدون قرارداد." />
      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id)}
            aria-pressed={kind === k.id}
            className={cx('relative flex items-center gap-3 rounded-2xl p-4 text-start transition duration-300', kind === k.id ? 'glass-red' : 'well text-zinc-400 hover:text-white')} style={{ '--cut': '12px' }}
          >
            <span className={cx('grid size-10 shrink-0 place-items-center', kind === k.id ? 'bg-white text-black' : 'bg-white/10')}><k.icon className="size-5" /></span>
            <span className="min-w-0">
              <span className="block truncate font-black">{k.label}</span>
              <span className="block truncate text-xs text-silver">{k.id === 'ping' ? 'حجمی / زمانی' : k.id === 'dns' ? 'بر اساس تعداد آی‌پی' : 'کاهش پینگ + DNS + VIP سرورهای CS2'}</span>
            </span>
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.5fr_1fr]">
        <Card className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-black">{isDns ? 'تعداد آی‌پی مجاز' : 'حجم ترافیک ماهانه'}</div>
            {!isDns && (tier === 'inf' ? <Badge tone="brand">زمانی · بدون سقف حجم</Badge> : <Badge>حجمی</Badge>)}
          </div>
          <div className="mt-3 text-6xl leading-none font-black">
            {isDns ? <>{fa(slots)} <span className="text-lg text-silver">آی‌پی</span></> : tier === 'inf' ? 'نامحدود' : <><Mono>{tier}</Mono> <Mono className="text-lg text-silver">GB</Mono></>}
          </div>
          <div className="relative mt-6">
            <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 bg-white/15" dir="ltr">
              <div className="h-2 bg-brand" style={{ width: `${(idx / (steps.length - 1)) * 100}%` }} />
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
                className={cx('relative rounded-2xl px-2 py-3.5 text-center transition', months === m ? 'glass-red' : 'well hover:bg-white/[0.04]')} style={{ '--cut': '10px' }} style={{ '--cut': '10px' }}
              >
                <div className="font-black">{fa(m)} ماهه</div>
                <div className={cx('text-[11px]', s.pricing.dur[m] ? 'text-ok' : 'text-zinc-500')}>{s.pricing.dur[m] ? `${fa(s.pricing.dur[m])}٪ تخفیف` : 'قیمت پایه'}</div>
              </button>
            ))}
          </div>
        </Card>

        <Card red className="flex flex-col p-6 sm:p-8">
          <div className="flex items-center gap-2 text-sm font-black"><K.icon className="size-4 text-brand2" /> {K.label}</div>
          <ul className="mt-4 space-y-2 text-sm text-zinc-300">
            {K.feats.map((f) => <li key={f} className="flex items-start gap-2"><Check className="mt-1 size-4 shrink-0 text-ok" />{f}</li>)}
          </ul>
          <div className="mt-auto pt-6">
            {p.off > 0 && <div className="text-sm text-zinc-500 line-through">{toman(p.gross)}</div>}
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-6xl leading-none font-black">{fa(p.total)}</span>
              <span className="text-silver">تومان</span>
            </div>
            <div className="mt-1 text-xs text-silver">معادل ماهی {toman(Math.round(p.total / months / 1000) * 1000)}</div>
            <Btn size="lg" icon={ShoppingCart} className="mt-6 w-full" onClick={() => setOrder({ kind, tier, slots, months, title, ...p })}>خرید و فعال‌سازی آنی</Btn>
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
      <Hero />
      <ServersHub />
      <Pricing go={go} />
    </>
  );
}
