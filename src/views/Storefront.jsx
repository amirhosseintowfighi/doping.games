import { useMemo, useState } from 'react';
import { ArrowLeft, BadgePercent, Check, ChevronDown, Crown, Play, Search, ShieldCheck, Wallet } from 'lucide-react';
import { useStore } from '../store.jsx';
import { GameCover, ModeEmblem } from '../art.jsx';
import { Badge, Btn, Card, CopyBtn, cx, Dot, Field, Modal, Mono, Progress, SectionTitle, Tabs } from '../ui.jsx';
import { EXITS, fa, GAMES, GB, MODES, PLAN_NAME, priceOf, rint, tierLabel, TIERS, toman } from '../data.js';

const jump = (id) => document.getElementById(id)?.scrollIntoView();

/* ───────────────────────── Hero ───────────────────────── */

/** The one live element on the page: ping to each game's servers, with and without Doping. */
function LivePing() {
  const { s, set } = useStore();
  const [on, setOn] = useState(true);
  const wob = useMemo(() => GAMES.map(() => rint(-2, 2)), [s.tick]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>پینگ تا سرور بازی</span>
        <span className="flex items-center gap-1.5"><Dot /> زنده</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-ink p-1" role="tablist">
        {[[false, 'بدون دوپینگ'], [true, 'با دوپینگ']].map(([v, label]) => (
          <button key={label} type="button" role="tab" aria-selected={on === v} onClick={() => setOn(v)} className={cx('rounded-lg py-2 text-[13px] transition-colors', on === v ? (v ? 'bg-brand font-bold text-white' : 'bg-white/10 font-bold text-white') : 'text-zinc-400 hover:text-white')}>
            {label}
          </button>
        ))}
      </div>
      <ul className="mt-3">
        {GAMES.map((g, i) => {
          const [ping, loss] = on ? g.via[s.exit] : g.isp;
          const p = ping + wob[i] * (on ? 1 : 4);
          return (
            <li key={g.id} className="flex items-center gap-3 border-b border-line py-3 last:border-0">
              <div className="w-24 shrink-0" dir="ltr">
                <Mono className="block text-[13px] font-bold">{g.name}</Mono>
                <Mono className="block truncate text-[11px] text-zinc-600">{g.dc}</Mono>
              </div>
              <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-line" dir="ltr">
                <div className={cx('h-full rounded-full transition-[width] duration-700', on ? 'bg-ok' : 'bg-zinc-500')} style={{ width: `${Math.min(100, (p / 180) * 100)}%` }} />
              </div>
              <div className="w-20 shrink-0 text-end" dir="ltr">
                <Mono className={cx('text-lg font-bold', on ? 'text-white' : 'text-zinc-400')}>{p}</Mono>
                <Mono className="ms-1 text-[11px] text-zinc-600">ms</Mono>
                <Mono className={cx('block text-[11px]', loss ? 'text-warn' : 'text-zinc-600')}>{loss}% loss</Mono>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-500">
        <span>خروجی:</span>
        {EXITS.map((e) => (
          <button key={e.id} type="button" aria-pressed={e.id === s.exit} onClick={() => { set({ exit: e.id }); setOn(true); }} className={cx('rounded-md px-2 py-1 transition-colors', e.id === s.exit ? 'bg-white/10 text-white' : 'hover:text-white')}>
            {e.name}
          </button>
        ))}
      </div>
    </Card>
  );
}

function Hero() {
  const { s } = useStore();
  const h = s.site.hero;
  const live = { '{nodes}': fa(s.routers.length), '{online}': fa(s.servers.reduce((a, v) => a + v.players, 0)) };
  const stats = s.site.stats.map((x) => ({ ...x, live: live[x.value.trim()] }));
  return (
    <section className="gutter mx-auto max-w-6xl pt-14 sm:pt-20">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_26rem] lg:gap-16">
        <div className="min-w-0">
          <h1 className="text-[2.6rem] leading-[1.25] font-black sm:text-6xl sm:leading-[1.2]">
            {h.line1}
            {h.line1 && <br />}
            <span className="text-brand2">{h.accent}</span> {h.line2}
          </h1>
          {h.desc && <p className="mt-6 max-w-md text-[15px] leading-8 text-zinc-400">{h.desc}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            <Btn size="lg" onClick={() => jump('pricing')}>{h.cta1} <ArrowLeft className="size-4" /></Btn>
            <Btn size="lg" variant="ghost" onClick={() => jump('servers')}>{h.cta2}</Btn>
          </div>
        </div>
        <LivePing />
      </div>

      {stats.length > 0 && (
        <dl className={cx('mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line', stats.length >= 4 ? 'sm:grid-cols-4' : stats.length === 3 ? 'sm:grid-cols-3' : '')}>
          {stats.map((x, i) => (
            <div key={i} className={cx('bg-ink px-6 py-5', stats.length % 2 === 1 && i === stats.length - 1 && 'max-sm:col-span-2')}>
              <dd className="text-2xl font-black sm:text-3xl">{x.live ?? <Mono>{x.value}</Mono>}</dd>
              <dt className="mt-1 text-xs text-zinc-500">{x.label}</dt>
            </div>
          ))}
        </dl>
      )}
    </section>
  );
}

/* ───────────────────────── Covered games ───────────────────────── */

function Games() {
  const { s } = useStore();
  const t = s.site.text.games;
  if (!s.site.games.length) return null;
  return (
    <section className="gutter mx-auto max-w-6xl pt-24">
      <SectionTitle label={t.label} title={t.title} desc={t.desc} />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {s.site.games.map((g, i) => (
          <GameCover key={g.id} name={g.name} index={i}>
            <div className="mt-2 flex items-baseline gap-2 text-xs" dir="ltr">
              <Mono className="text-zinc-600 line-through">{g.isp}</Mono>
              <Mono className="font-bold text-ok">{g.dp}ms</Mono>
            </div>
          </GameCover>
        ))}
      </div>
    </section>
  );
}

/* ───────────────────────── Game servers ───────────────────────── */

function ServerRow({ v }) {
  const { toast } = useStore();
  const addr = `${v.host}:${v.port}`;
  const full = v.players >= v.max;
  const on = v.status === 'online';
  const steam = v.game !== 'Minecraft';
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 border-t border-line px-4 py-4 sm:px-5 lg:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,0.9fr)_9rem_4rem_auto]">
      <ModeEmblem mode={v.mode} vip={v.vip} />
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <Mono className="truncate text-sm font-bold">{v.name}</Mono>
          {v.vip && <Crown className="size-3.5 shrink-0 text-warn" aria-label="VIP" />}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 text-[11px] text-zinc-500">
          <Mono>{v.tick}</Mono>
          <span className="inline-flex items-center gap-1"><ShieldCheck className="size-3" /><Mono>{v.ac}</Mono></span>
          {!on && <span className="text-brand2">آفلاین</span>}
        </div>
      </div>
      <Mono className={cx('text-sm font-bold lg:hidden', v.ping <= 20 ? 'text-ok' : 'text-warn')}>{on ? `${v.ping}ms` : '—'}</Mono>

      <Mono className="col-span-3 truncate text-sm text-zinc-300 lg:col-span-1">{v.map}</Mono>
      <div className="col-span-3 lg:col-span-1">
        <div className="mb-1.5 flex justify-between text-xs" dir="ltr">
          <Mono><b className="font-bold text-white">{v.players}</b><span className="text-zinc-600">/{v.max} Players</span></Mono>
          {full && <span className="text-brand2">پر</span>}
        </div>
        <Progress value={(v.players / v.max) * 100} tone={full ? 'bg-brand2' : 'bg-white'} />
      </div>
      <Mono className={cx('hidden text-sm font-bold lg:block', v.ping <= 20 ? 'text-ok' : 'text-warn')}>{on ? `${v.ping}ms` : '—'}</Mono>
      <div className="col-span-3 flex flex-wrap items-center justify-end gap-2 lg:col-span-1">
        <CopyBtn text={steam ? `connect ${addr}` : addr} label="کپی IP" variant="ghost" size="md" />
        {steam ? (
          <a
            href={`steam://connect/${addr}`}
            onClick={() => toast(full ? 'سرور پره؛ با اسلات رزرو VIP وارد می‌شی.' : 'درخواست اتصال به Steam فرستاده شد.', full ? 'warn' : 'ok')}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-[13px] font-bold whitespace-nowrap text-black transition-colors hover:bg-zinc-200"
          >
            <Play className="size-3.5 fill-current" /> اتصال سریع <Mono className="font-normal text-zinc-600">(Steam Connect)</Mono>
          </a>
        ) : (
          <CopyBtn text={addr} label="کپی آدرس سرور" variant="outline" size="md" />
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
  const modes = MODES.filter((m) => m.id === 'all' || s.servers.some((v) => v.mode === m.id));

  return (
    <section id="servers" className="gutter mx-auto max-w-6xl scroll-mt-24 pt-24">
      <SectionTitle
        label={s.site.text.servers.label}
        title={s.site.text.servers.title}
        desc={s.site.text.servers.desc}
        action={<span className="flex items-center gap-2 text-xs text-zinc-400"><Dot /> {fa(s.servers.filter((v) => v.status === 'online').length)} سرور آنلاین</span>}
      />
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Tabs tabs={modes} value={mode} onChange={setMode} />
        <label className="ms-auto flex items-center gap-2 text-xs text-zinc-400">
          <input id="srv-free" type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} className="size-4 accent-white" />
          فقط جای خالی
        </label>
        <div className="relative w-full sm:w-56">
          <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-zinc-600" />
          <input id="srv-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسم سرور یا مپ…" className="field pr-9" />
        </div>
      </div>
      <Card className="mt-4 overflow-hidden">
        <div className="hidden grid-cols-[auto_minmax(0,1.4fr)_minmax(0,0.9fr)_9rem_4rem_auto] gap-x-4 px-5 py-3 text-xs text-zinc-500 lg:grid">
          <span className="w-10" /><span>سرور</span><span>مپ</span><span>بازیکن‌ها</span><span>پینگ</span><span className="w-[19.5rem]" />
        </div>
        {list.length ? <ul className="max-lg:[&>li:first-child]:border-t-0">{list.map((v) => <ServerRow key={v.id} v={v} />)}</ul> : <p className="p-10 text-center text-sm text-zinc-500">سروری با این فیلتر پیدا نشد.</p>}
      </Card>
    </section>
  );
}

/* ───────────────────────── Plans & checkout ───────────────────────── */

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


const KINDS = [
  { id: 'ping', label: 'کاهش پینگ' },
  { id: 'dns', label: 'DNS ضد تحریم' },
  { id: 'pro', label: 'پکیج پرو' },
];
const SLOTS = [1, 2, 3, 5];

function Pricing({ go }) {
  const { s } = useStore();
  const [kind, setKind] = useState('ping');
  const [months, setMonths] = useState(1);
  const [order, setOrder] = useState(null);
  const isDns = kind === 'dns';
  const options = isDns ? SLOTS : TIERS;
  const popular = isDns ? 2 : 30;
  const periods = [1, 3, 6].map((m) => ({ id: m, label: `${fa(m)} ماهه`, note: s.pricing.dur[m] ? `${fa(s.pricing.dur[m])}٪ تخفیف` : null }));

  return (
    <section id="pricing" className="gutter mx-auto max-w-6xl scroll-mt-24 pt-24">
      <SectionTitle label={s.site.text.pricing.label} title={s.site.text.pricing.title} desc={s.site.text.pricing.desc} />
      <div className="mt-8 flex flex-wrap items-center gap-3">
        <Tabs tabs={KINDS} value={kind} onChange={setKind} />
        <Tabs tabs={periods} value={months} onChange={setMonths} />
      </div>
      <div className={cx('mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2', isDns ? 'lg:grid-cols-4' : 'lg:grid-cols-5')}>
        {options.map((opt) => {
          const p = priceOf(s.pricing, { kind, tier: isDns ? 15 : opt, slots: isDns ? opt : 1, months });
          const hot = opt === popular;
          const name = isDns ? `${fa(opt)} آی‌پی` : tierLabel(opt);
          const title = isDns ? `DNS ضد تحریم · ${fa(opt)} آی‌پی · ${fa(months)} ماهه` : `${PLAN_NAME[kind]} · ${tierLabel(opt)} · ${fa(months)} ماهه`;
          return (
            <Card key={opt} className={cx('flex flex-col p-5', hot && 'border-zinc-500')}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-zinc-400">{isDns ? 'تعداد آی‌پی' : opt === 'inf' ? 'زمانی' : 'حجمی'}</span>
                {hot && <Badge tone="brand">پرفروش</Badge>}
              </div>
              <div className="mt-1 text-xl font-black">{name}</div>
              <div className="mt-5 flex items-baseline gap-1.5">
                <span className="text-3xl font-black">{fa(p.total / 1000)}</span>
                <span className="text-xs text-zinc-500">هزار تومان</span>
              </div>
              <div className="text-xs text-zinc-600">{months > 1 ? `ماهی ${toman(Math.round(p.total / months / 1000) * 1000)}` : 'ماهانه'}</div>
              <Btn variant={hot ? 'primary' : 'ghost'} className="mt-5 w-full" onClick={() => setOrder({ kind, tier: opt, slots: opt, months, title, ...p })}>فعال‌سازی</Btn>
              <ul className="mt-5 space-y-2 border-t border-line pt-4 text-xs text-zinc-400">
                {s.site.feats[kind].map((f) => <li key={f} className="flex items-start gap-2"><Check className="mt-0.5 size-3.5 shrink-0 text-zinc-500" />{f}</li>)}
              </ul>
            </Card>
          );
        })}
      </div>
      {order && <Checkout order={order} onClose={() => setOrder(null)} go={go} />}
    </section>
  );
}

/* ───────────────────────── FAQ & closing ───────────────────────── */

function Faq() {
  const { s } = useStore();
  const [open, setOpen] = useState(0);
  const t = s.site.text.faq;
  if (!s.site.faq.length) return null;
  return (
    <section className="gutter mx-auto grid max-w-6xl grid-cols-1 gap-8 pt-24 lg:grid-cols-[20rem_1fr] lg:gap-16">
      <SectionTitle label={t.label} title={t.title} desc={t.desc} />
      <div className="flex flex-col gap-2">
        {s.site.faq.map((f, i) => (
          <Card key={f.id}>
            <button type="button" onClick={() => setOpen(open === i ? -1 : i)} aria-expanded={open === i} className="flex w-full items-center gap-3 px-5 py-4 text-start text-sm font-bold">
              <span className="flex-1">{f.q}</span>
              <ChevronDown className={cx('size-4 shrink-0 text-zinc-500 transition-transform', open === i && 'rotate-180')} />
            </button>
            {open === i && <p className="px-5 pb-5 text-sm leading-7 whitespace-pre-line text-zinc-400">{f.a}</p>}
          </Card>
        ))}
      </div>
    </section>
  );
}

export default function Storefront({ go }) {
  const { s } = useStore();
  const { show, text, hero } = s.site;
  return (
    <>
      <Hero />
      {show.games && <Games />}
      {show.servers && <ServersHub />}
      {show.pricing && <Pricing go={go} />}
      {show.faq && <Faq />}
      {show.cta && (
        <section className="gutter mx-auto max-w-6xl pt-24">
          <div className="rounded-2xl border border-line bg-card px-6 py-14 text-center">
            <h2 className="text-2xl font-black sm:text-4xl">{text.cta.title}</h2>
            {text.cta.desc && <p className="mx-auto mt-3 max-w-md text-sm text-zinc-400">{text.cta.desc}</p>}
            <div className="mt-7 flex flex-wrap justify-center gap-3">
              {show.pricing && <Btn size="lg" onClick={() => jump('pricing')}>{hero.cta1}</Btn>}
              <Btn size="lg" variant="ghost" onClick={() => go('panel')}>ورود به پنل</Btn>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
