import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, BadgePercent, Check, CircleCheck, Crown, Globe, Infinity as Inf, Play, Rocket, Search, ShieldCheck, ShoppingCart, Timer, Wallet, Zap,
} from 'lucide-react';
import { useStore } from '../store.jsx';
import { ModeEmblem, Pips, RouteMap, Wave } from '../art.jsx';
import { Badge, Btn, Card, CopyBtn, cx, Dot, Field, Modal, Mono, SectionTitle } from '../ui.jsx';
import { EXITS, fa, GAMES, GB, MODES, PLAN_NAME, priceOf, rint, tierLabel, TIERS, toman } from '../data.js';

/* ───────────────────────── Hero: live route stage ───────────────────────── */

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

function Readout({ label, eyebrow, ping, loss, jitter, good, seed }) {
  return (
    <div className={cx('relative min-w-0 rounded-2xl p-5', good ? 'glass-red' : 'well')}>
      <div className="flex items-center justify-between gap-2">
        <span className="eyebrow">{eyebrow}</span>
        {good ? <Zap className="size-4 text-brand2" /> : <Globe className="size-4 text-zinc-600" />}
      </div>
      <div className="mt-1 text-sm text-zinc-300">{label}</div>
      <div className="mt-3 flex items-end justify-between gap-3" dir="ltr">
        <div className="flex items-baseline gap-1.5">
          <span className={cx('mono text-5xl leading-none font-light', good ? 'text-white' : 'text-zinc-400')}>{ping}</span>
          <span className="mono text-xs text-zinc-500">ms</span>
        </div>
        <Wave seed={seed} color={good ? '#10B981' : '#F59E0B'} jitter={good ? 2 : 11} className="h-9 w-28" />
      </div>
      <div className="hairline my-4" />
      <dl className="flex justify-between text-xs text-zinc-500">
        <div>پکت لاس <Mono className={cx('ms-1 font-bold', loss > 0 ? 'text-warn' : 'text-ok')}>{loss}%</Mono></div>
        <div>جیتر <Mono className="ms-1 font-bold text-zinc-200">±{jitter}ms</Mono></div>
      </dl>
    </div>
  );
}

const pill = (on) => cx('shrink-0 rounded-full px-3.5 py-1.5 text-xs whitespace-nowrap transition', on ? 'bg-white/[0.1] font-bold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.14)]' : 'text-zinc-500 hover:text-white');

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
  const saved = Math.round((1 - tPing / game.isp[0]) * 100);
  const online = s.servers.reduce((a, v) => a + v.players, 0);
  const jump = (id) => document.getElementById(id)?.scrollIntoView();

  return (
    <section className="relative">
      <div className="gutter mx-auto max-w-4xl pt-16 pb-12 text-center sm:pt-24">
        <div className="eyebrow">Gaming Network · RouterOS v7 · WireGuard</div>
        <h1 className="mt-7 text-[3.4rem] leading-[1.12] font-extralight sm:text-8xl">
          پینگت رو <span className="text-brand-grad font-black drop-shadow-[0_0_40px_rgba(230,0,18,.45)]">دوپینگ</span> کن!
        </h1>
        <p className="mx-auto mt-7 max-w-xl text-base text-zinc-400">
          تانل اختصاصی گیمینگ از لبه ایران تا خروجی عمان، امارات و اروپا. پینگ پایین، بدون پکت لاس، بدون تحریم.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <Btn size="lg" icon={Rocket} onClick={() => jump('pricing')}>خرید سرویس</Btn>
          <Btn size="lg" variant="ghost" onClick={() => jump('servers')}>سرورهای CS2</Btn>
        </div>
      </div>

      <div className="gutter mx-auto max-w-7xl">
        <div className="glass relative overflow-hidden rounded-[32px]">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-5 sm:px-7">
            <div className="flex items-center gap-3">
              <Dot /><span className="eyebrow">Live route · {game.full}</span>
            </div>
            <div className="flex max-w-full gap-1 overflow-x-auto" role="tablist" aria-label="انتخاب بازی">
              {GAMES.map((g) => (
                <button key={g.id} type="button" role="tab" aria-selected={g.id === gameId} onClick={() => setGameId(g.id)} className={cx('mono', pill(g.id === gameId))}>{g.name}</button>
              ))}
            </div>
          </div>

          <RouteMap exit={s.exit} ping={dp} ispPing={isp} dcLabel={game.dc.toUpperCase()} className="block w-full" />

          <div className="grid grid-cols-1 gap-3 p-3 sm:p-5 lg:grid-cols-[1fr_1fr_0.8fr]">
            <Readout eyebrow="Standard ISP" label="اینترنت معمولی" ping={isp} loss={game.isp[1]} jitter={game.isp[2]} seed={s.tick + 3} />
            <Readout good eyebrow={`Doping · ${exit.code}`} label={`مسیر دوپینگ از ${exit.name}`} ping={dp} loss={tLoss} jitter={tJit} seed={s.tick} />
            <div className="well flex min-w-0 flex-col rounded-2xl p-5">
              <span className="eyebrow">Exit node</span>
              <div className="mt-3 flex flex-wrap gap-1">
                {EXITS.map((e) => (
                  <button key={e.id} type="button" aria-pressed={e.id === s.exit} onClick={() => { set({ exit: e.id }); setRun((r) => r + 1); }} className={pill(e.id === s.exit)}>
                    {e.name}{e.id === best && <span className="ms-1 text-ok">★</span>}
                  </button>
                ))}
              </div>
              <div className="mt-auto pt-5">
                <Mono className="text-5xl leading-none font-light text-ok">{saved}%</Mono>
                <div className="mt-2 text-xs text-zinc-500">پینگ کمتر نسبت به مسیر معمولی</div>
              </div>
            </div>
          </div>
        </div>

        <dl className="mt-10 grid grid-cols-3 text-center">
          {[[<Mono key="a">28ms</Mono>, 'میانگین پینگ CS2'], [<Mono key="b">0%</Mono>, 'پکت لاس روی تانل'], [fa(online), 'گیمر آنلاین روی سرورها']].map(([v, l], i) => (
            <div key={l} className={cx('px-2', i && 'border-s border-white/[0.07]')}>
              <dd className="text-3xl font-extralight sm:text-5xl">{v}</dd>
              <dt className="mt-2 text-xs text-zinc-500">{l}</dt>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

/* ───────────────────────── Game servers hub ───────────────────────── */

function ServerCard({ v }) {
  const { s, toast } = useStore();
  const addr = `${v.host}:${v.port}`;
  const full = v.players >= v.max;
  const on = v.status === 'online';
  const steam = v.game !== 'Minecraft';
  return (
    <Card className="group flex min-w-0 flex-col p-5 transition duration-500 hover:-translate-y-1 hover:shadow-[inset_0_1px_0_rgba(255,255,255,.08),0_40px_80px_-40px_rgba(230,0,18,.45)]">
      <div className="flex items-start gap-3.5">
        <ModeEmblem mode={v.mode} vip={v.vip} className="size-14 shrink-0 transition duration-500 group-hover:drop-shadow-[0_0_14px_rgba(230,0,18,.7)]" />
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="flex items-center gap-2">
            <Dot tone={on ? 'ok' : 'bad'} />
            <span className="eyebrow truncate">{v.game} · {MODES.find((m) => m.id === v.mode)?.label.replace('CS2 ', '')}</span>
            {v.vip && <Crown className="size-3.5 shrink-0 text-warn" aria-label="VIP" />}
          </div>
          <Mono className="mt-1.5 block truncate text-[13px] font-bold">{v.name}</Mono>
        </div>
      </div>

      <div className="mt-6 flex items-end justify-between gap-3" dir="ltr">
        <div className="min-w-0">
          <span className="eyebrow">Map</span>
          <Mono className="block truncate text-xl font-light">{v.map}</Mono>
        </div>
        <div className="shrink-0 text-right">
          <span className="eyebrow">Ping</span>
          <div className="flex items-baseline gap-1">
            <Mono className={cx('text-xl font-light', v.ping <= 20 ? 'text-ok' : 'text-warn')}>{on ? v.ping : '—'}</Mono>
            <Mono className="text-[10px] text-zinc-600">ms</Mono>
          </div>
        </div>
      </div>
      <Wave seed={v.ping * 7 + s.tick} jitter={2.5} className="mt-1 h-5 w-full opacity-70" />

      <div className="mt-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs text-zinc-500">بازیکن‌ها</span>
          <Mono className="text-xs"><b className="font-bold text-white">{v.players}</b><span className="text-zinc-600">/{v.max} Players</span></Mono>
        </div>
        <Pips value={v.players} max={v.max} />
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5">
        <Badge><Mono>{v.tick}</Mono></Badge>
        <Badge tone="ok" icon={ShieldCheck}><Mono>{v.ac}</Mono></Badge>
      </div>

      <div className="well mt-4 flex items-center justify-between gap-2 rounded-full py-1 ps-4 pe-1">
        <Mono className="truncate text-xs text-zinc-400">{addr}</Mono>
        <CopyBtn text={steam ? `connect ${addr}` : addr} label="کپی IP" />
      </div>

      {steam ? (
        <a
          href={`steam://connect/${addr}`}
          onClick={() => toast(full ? 'سرور پره؛ با اسلات رزرو VIP وارد می‌شی.' : 'درخواست اتصال به Steam فرستاده شد.', full ? 'warn' : 'ok')}
          className="bg-brand-grad mt-3 inline-flex h-11 items-center justify-center gap-2 rounded-full text-[13px] font-black shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_10px_30px_-10px_rgba(230,0,18,.8)] transition hover:brightness-110 active:scale-[0.98]"
        >
          <Play className="size-3.5 fill-current" /> اتصال سریع <Mono className="font-normal opacity-75">(Steam Connect)</Mono>
        </a>
      ) : (
        <CopyBtn text={addr} label="کپی آدرس سرور" variant="primary" size="md" className="mt-3 h-11" />
      )}
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
    <section id="servers" className="gutter mx-auto max-w-7xl scroll-mt-28 pt-28">
      <SectionTitle
        eyebrow="Doping game servers"
        title="بپر تو سرور، همین الان"
        desc="سرورهای اختصاصی CS2 روی نود داخلی ایران با Sub-tick، آنتی‌چیت و پینگ زیر ۱۵. برای اتصال، Steam باید روی سیستمت باز باشه."
        action={<Badge tone="ok"><Dot /> {fa(s.servers.filter((v) => v.status === 'online').length)} سرور آنلاین</Badge>}
      />
      <div className="mt-10 flex flex-wrap items-center gap-4">
        <div className="flex min-w-0 flex-1 gap-1 overflow-x-auto">
          {MODES.map((m) => (
            <button key={m.id} type="button" onClick={() => setMode(m.id)} aria-pressed={mode === m.id} className={pill(mode === m.id)}>
              {m.label} <Mono className="ms-1 text-zinc-600">{count(m.id)}</Mono>
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-xs text-zinc-500">
          <input id="srv-free" type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} className="size-4 accent-[#e60012]" />
          فقط جای خالی
        </label>
        <div className="relative w-full sm:w-64">
          <Search className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-zinc-600" />
          <input id="srv-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسم سرور یا مپ…" className="field rounded-full pr-10" />
        </div>
      </div>
      {list.length ? (
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{list.map((v) => <ServerCard key={v.id} v={v} />)}</div>
      ) : (
        <Card className="mt-8 p-12 text-center text-sm text-zinc-500">سروری با این فیلتر پیدا نشد. فیلتر رو عوض کن.</Card>
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
      <div className="well rounded-2xl p-5">
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
                className={cx('relative flex items-center gap-3 rounded-2xl p-3.5 text-start transition', gw === g.id ? 'glass-red' : 'well hover:bg-white/[0.04]')}
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
      <SectionTitle eyebrow="Service store" title="پلنت رو خودت بساز" desc="حجم و مدت رو انتخاب کن؛ قیمت همون لحظه حساب می‌شه. فعال‌سازی آنی، بدون قرارداد." />
      <div className="mt-10 grid gap-3 sm:grid-cols-3">
        {KINDS.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => setKind(k.id)}
            aria-pressed={kind === k.id}
            className={cx('relative flex items-center gap-3 rounded-2xl p-4 text-start transition duration-300', kind === k.id ? 'glass-red' : 'well text-zinc-400 hover:text-white')}
          >
            <span className={cx('grid size-10 shrink-0 place-items-center rounded-full', kind === k.id ? 'bg-brand-grad shadow-[0_0_24px_-4px_#e60012]' : 'bg-white/5')}><k.icon className="size-5" /></span>
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
            {!isDns && (tier === 'inf' ? <Badge tone="brand" icon={Inf}>زمانی · بدون سقف حجم</Badge> : <Badge icon={Timer}>حجمی</Badge>)}
          </div>
          <div className="mt-3 text-6xl leading-none font-extralight">
            {isDns ? <>{fa(slots)} <span className="text-lg text-silver">آی‌پی</span></> : tier === 'inf' ? 'نامحدود' : <><Mono>{tier}</Mono> <Mono className="text-lg text-silver">GB</Mono></>}
          </div>
          <div className="relative mt-6">
            <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/15" dir="ltr">
              <div className="h-px bg-brand2 shadow-[0_0_12px_1px_#ff1e27]" style={{ width: `${(idx / (steps.length - 1)) * 100}%` }} />
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
                className={cx('relative rounded-2xl px-2 py-3.5 text-center transition', months === m ? 'glass-red' : 'well hover:bg-white/[0.04]')}
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
              <span className="text-6xl leading-none font-extralight">{fa(p.total)}</span>
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
