import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, BadgePercent, Check, ChevronDown, Crown, MessageCircleQuestion, Play, RotateCcw, Search, ShieldCheck, Star, Wallet, X } from 'lucide-react';
import HeroScene from './HeroScene.jsx';
import { CountUp, useParallax } from '../motion.jsx';
import { useStore } from '../store.jsx';
import { GameCover, ModeEmblem } from '../art.jsx';
import { coverSrc } from '../covers.js';
import { Badge, Btn, Card, CopyBtn, cx, Dot, Field, Modal, Mono, Progress, SectionTitle, Tabs } from '../ui.jsx';
import { bestPing, dnsSlots, durations, EXITS, fa, GB, ISPS, MODES, pingTiers, priceOf, recommendTier, tierLabel, toman, trackedGames } from '../data.js';

const jump = (id) => document.getElementById(id)?.scrollIntoView();
const SAMPLES = 24;

/* ───────────────────────── Hero: ping test ───────────────────────── */

/** Deterministic noise so a finished test looks the same on every render. */
function noise(seed) {
  let x = seed * 9301 + 49297;
  return () => ((x = (x * 9301 + 49297) % 233280) / 233280);
}
/** One run of samples for both routes. `null` marks a lost packet. */
function makeRun(game, isp, exit, seed) {
  const r = noise(seed);
  const [base, loss, jit] = game.isp;
  const [dp, , djit] = game.via[exit];
  const ispBase = base * isp.k;
  const ispLoss = Math.max(0, loss + isp.loss);
  return Array.from({ length: SAMPLES }, () => ({
    isp: r() * 100 < ispLoss ? null : Math.round(ispBase + (r() - 0.5) * jit * 2 * isp.k + (r() > 0.88 ? jit * 2 : 0)),
    dp: Math.round(dp + (r() - 0.5) * djit * 2),
  }));
}
function summarise(list) {
  const got = list.filter((v) => v != null);
  if (!got.length) return { avg: 0, loss: 0, jit: 0 };
  const avg = got.reduce((a, v) => a + v, 0) / got.length;
  const jit = got.slice(1).reduce((a, v, i) => a + Math.abs(v - got[i]), 0) / Math.max(1, got.length - 1);
  return { avg: Math.round(avg), loss: Math.round(((list.length - got.length) / list.length) * 100), jit: Math.round(jit) };
}

function PingChart({ run, count }) {
  const W = 320, H = 110, P = 6;
  const max = Math.max(60, ...run.map((s) => s.isp ?? 0)) * 1.1;
  const x = (i) => P + (i / (SAMPLES - 1)) * (W - P * 2);
  const y = (v) => H - P - (v / max) * (H - P * 2);
  const path = (key) => {
    let d = '';
    run.slice(0, count).forEach((s, i) => {
      if (s[key] == null) return;
      d += `${d && run[i - 1]?.[key] != null ? 'L' : 'M'}${x(i).toFixed(1)} ${y(s[key]).toFixed(1)}`;
    });
    return d;
  };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block h-28 w-full" preserveAspectRatio="none" aria-hidden="true">
      {[0.25, 0.5, 0.75].map((k) => <line key={k} x1="0" x2={W} y1={H * k} y2={H * k} stroke="#1f1f26" strokeWidth="1" vectorEffect="non-scaling-stroke" />)}
      <path d={path('isp')} fill="none" stroke="#71717a" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {run.slice(0, count).map((s, i) => s.isp == null && <line key={i} x1={x(i)} x2={x(i)} y1={H - P - 10} y2={H - P} stroke="#f59e0b" strokeWidth="2" vectorEffect="non-scaling-stroke" />)}
      <path d={path('dp')} fill="none" stroke="#10b981" strokeWidth="2" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      {count > 0 && count < SAMPLES && <circle cx={x(count - 1)} cy={y(run[count - 1].dp)} r="3" fill="#10b981" />}
    </svg>
  );
}

function PingTest() {
  const { s, set } = useStore();
  const GAMES = trackedGames(s.site);
  const game = GAMES.find((g) => g.id === s.prefs.game) ?? GAMES[0];
  const isp = ISPS.find((i) => i.id === s.prefs.isp) ?? ISPS[0];
  const [seed, setSeed] = useState(7);
  const [count, setCount] = useState(SAMPLES);
  const timer = useRef(null);
  const run = useMemo(() => makeRun(game, isp, s.exit, seed), [game, isp, s.exit, seed]);
  const best = Object.entries(game.via).sort((a, b) => a[1][0] - b[1][0])[0][0];
  const running = count < SAMPLES;
  const pref = (k, v) => set((p) => ({ prefs: { ...p.prefs, [k]: v } }));

  const start = () => {
    clearInterval(timer.current);
    setSeed((x) => x + 1);
    setCount(0);
    timer.current = setInterval(() => setCount((c) => {
      if (c + 1 >= SAMPLES) clearInterval(timer.current);
      return Math.min(SAMPLES, c + 1);
    }), 110);
  };
  useEffect(() => () => clearInterval(timer.current), []);
  // A "test this game" request from a game card restarts the test.
  const firstRun = useRef(s.pingRun);
  useEffect(() => { if (s.pingRun !== firstRun.current) start(); }, [s.pingRun]); // eslint-disable-line react-hooks/exhaustive-deps

  const shown = run.slice(0, count);
  const a = summarise(shown.map((x) => x.isp));
  const b = summarise(shown.map((x) => x.dp));

  return (
    <Card id="ping-test" className="scroll-mt-24 p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-bold">تست پینگ</span>
        <span className="flex items-center gap-1.5 text-xs text-zinc-500">{running ? <><Dot /> در حال تست <Mono>{count}/{SAMPLES}</Mono></> : 'تخمینی'}</span>
      </div>

      <div className="mt-4 flex gap-2" role="radiogroup" aria-label="بازی">
        {GAMES.map((g) => (
          <button
            key={g.id} type="button" role="radio" aria-checked={g.id === game.id} aria-label={g.full} title={g.full}
            onClick={() => { pref('game', g.id); start(); }}
            className={cx('relative aspect-[2/3] min-w-0 flex-1 overflow-hidden rounded-lg border-2 transition', g.id === game.id ? 'border-white' : 'border-transparent opacity-50 hover:opacity-90')}
          >
            <img src={coverSrc(g.cover)} alt="" className="absolute inset-0 size-full object-cover" />
          </button>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="min-w-0">
          <span className="sr-only">اینترنت شما</span>
          <select id="ping-isp" value={isp.id} onChange={(e) => { pref('isp', e.target.value); start(); }} className="field py-2 text-[13px]">
            {ISPS.map((i) => <option key={i.id} value={i.id}>اینترنت {i.name}</option>)}
          </select>
        </label>
        <label className="min-w-0">
          <span className="sr-only">خروجی دوپینگ</span>
          <select id="ping-exit" value={s.exit} onChange={(e) => { set({ exit: e.target.value }); start(); }} className="field py-2 text-[13px]">
            {EXITS.map((e) => <option key={e.id} value={e.id}>خروجی {e.name}{e.id === best ? ' ★' : ''}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-4 rounded-xl bg-ink px-2 pt-2">
        <PingChart run={run} count={count} />
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line text-center">
        {[['اینترنت معمولی', a, 'text-zinc-300'], ['با دوپینگ', b, 'text-ok']].map(([label, r, tone]) => (
          <div key={label} className="bg-card px-3 py-3">
            <dt className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
              <span className={cx('size-2 rounded-full', tone === 'text-ok' ? 'bg-ok' : 'bg-zinc-500')} />{label}
            </dt>
            <dd className={cx('mt-1 text-2xl font-black', tone)}><Mono>{r.avg || '—'}</Mono><Mono className="ms-1 text-xs font-normal text-zinc-500">ms</Mono></dd>
            <dd className="text-[11px] text-zinc-500" dir="ltr"><Mono className={r.loss ? 'text-warn' : ''}>{r.loss}% loss</Mono> · <Mono>±{r.jit}ms</Mono></dd>
          </div>
        ))}
      </dl>

      <Btn variant={running ? 'ghost' : 'primary'} className="mt-3 w-full" icon={RotateCcw} onClick={start} busy={running}>
        {running ? 'در حال تست…' : 'تست دوباره'}
      </Btn>
    </Card>
  );
}

/** A stat value: live numbers and plain numbers count up; anything else is shown as typed. */
function StatValue({ raw, live }) {
  if (live != null) return <CountUp value={live} format={fa} />;
  const m = /^(\d+(?:\.\d+)?)(.*)$/.exec(raw.trim());
  if (!m) return <Mono>{raw}</Mono>;
  const decimals = (m[1].split('.')[1] ?? '').length;
  return <Mono><CountUp value={Number(m[1])} decimals={decimals} format={(n) => `${n.toFixed(decimals)}${m[2]}`} /></Mono>;
}

function Hero() {
  const { s } = useStore();
  const h = s.site.hero;
  const scene = useRef(null);
  useParallax(scene, { range: 180, mouse: 26 });
  const live = { '{nodes}': s.routers.length, '{online}': s.servers.reduce((a, v) => a + v.players, 0) };
  const stats = s.site.stats.map((x) => ({ ...x, live: live[x.value.trim()] }));
  return (
    <section ref={scene} className="relative isolate overflow-clip">
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div data-depth="-0.3" className="absolute top-1/3 right-[-12rem] size-[30rem] rounded-full bg-brand/[0.07] blur-3xl" />
      </div>
    <div className="gutter mx-auto max-w-6xl pt-14 sm:pt-20">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12">
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
          <button type="button" onClick={() => jump('ping-test')} className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm text-zinc-400 underline-offset-4 transition-colors hover:text-white hover:underline">
            <Dot /> {h.pingLink}
          </button>
        </div>
        {s.site.show.heroScene && <HeroScene />}
      </div>

      {stats.length > 0 && (
        <dl className={cx('mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line', stats.length >= 4 ? 'sm:grid-cols-4' : stats.length === 3 ? 'sm:grid-cols-3' : '')}>
          {stats.map((x, i) => (
            <div key={i} className={cx('bg-ink px-6 py-5', stats.length % 2 === 1 && i === stats.length - 1 && 'max-sm:col-span-2')}>
              <dd className="text-2xl font-black sm:text-3xl"><StatValue raw={x.value} live={x.live} /></dd>
              <dt className="mt-1 text-xs text-zinc-500">{x.label}</dt>
            </div>
          ))}
        </dl>
      )}
    </div>
    </section>
  );
}

/* ───────────────────────── Ping test section ───────────────────────── */

function PingSection() {
  const { s } = useStore();
  const t = s.site.text.ping;
  return (
    <section className="gutter mx-auto max-w-6xl pt-24">
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_24rem] lg:gap-16">
        <div className="min-w-0">
          <SectionTitle label={t.label} title={t.title} desc={t.desc} />
          <dl className="mt-8 grid max-w-md grid-cols-1 gap-3 text-sm sm:grid-cols-3">
            {t.items.filter((x) => x.k.trim()).map(({ k, v }, i) => (
              <div key={i} className="border-t border-line pt-3">
                <dt className="font-bold">{k}</dt>
                <dd className="mt-1 text-xs leading-6 text-zinc-500">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="mx-auto w-full max-w-md lg:max-w-none"><PingTest /></div>
      </div>
    </section>
  );
}

/* ───────────────────────── Covered games ───────────────────────── */

function GameDetails({ g, onClose }) {
  const { set } = useStore();
  const rows = EXITS.map((e) => [e, g.via[e.id]]);
  const dp = bestPing(g);
  const max = Math.max(g.isp, ...rows.map(([, v]) => v));
  const best = Math.min(...rows.map(([, v]) => v));
  return (
    <Modal open onClose={onClose} title={g.name} wide>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-[11rem_1fr]">
        <div className="mx-auto w-40 sm:w-full">
          <GameCover name={g.name} src={coverSrc(g.cover)} />
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline gap-3" dir="ltr">
            <Mono className="text-xl text-zinc-600 line-through">{g.isp}</Mono>
            <Mono className="text-4xl font-black text-ok">{dp}</Mono>
            <Mono className="text-sm text-zinc-500">ms</Mono>
          </div>
          <p className="mt-1 text-sm text-zinc-400">{fa(Math.max(0, Math.round((1 - dp / g.isp) * 100)))}٪ پینگ کمتر از اینترنت معمولی</p>

          <div className="mt-6 text-xs text-zinc-500">پینگ از هر خروجی</div>
          <ul className="mt-2 space-y-2.5">
            <li className="grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-3 text-sm">
              <span className="text-zinc-500">اینترنت معمولی</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-line" dir="ltr"><span className="block h-full rounded-full bg-zinc-600" style={{ width: `${(g.isp / max) * 100}%` }} /></span>
              <Mono className="text-end text-zinc-500">{g.isp}ms</Mono>
            </li>
            {rows.map(([e, v]) => (
              <li key={e.id} className="grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-3 text-sm">
                <span className={v === best ? 'font-bold' : 'text-zinc-400'}>{e.name}{v === best && <span className="ms-1 text-[11px] font-normal text-ok">بهترین</span>}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-line" dir="ltr"><span className={cx('block h-full rounded-full', v === best ? 'bg-ok' : 'bg-white/60')} style={{ width: `${(v / max) * 100}%` }} /></span>
                <Mono className="text-end">{v}ms</Mono>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-xs text-zinc-500">مصرف تقریبی هنگام بازی: <Mono className="text-zinc-300">{g.mb} MB</Mono> در ساعت</p>

          <div className="mt-6 flex flex-wrap gap-2">
            {g.featured && (
              <Btn onClick={() => { set((p) => ({ prefs: { ...p.prefs, game: g.id }, pingRun: p.pingRun + 1 })); onClose(); jump('ping-test'); }}>
                تست پینگ این بازی
              </Btn>
            )}
            <Btn variant="ghost" onClick={() => { onClose(); jump('pricing'); }}>خرید سرویس</Btn>
          </div>
        </div>
      </div>
    </Modal>
  );
}

/** Grid columns at the current width, so parallax can move whole columns together. */
function useCols() {
  const get = () => (typeof window === 'undefined' ? 5 : window.matchMedia('(min-width: 1024px)').matches ? 5 : window.matchMedia('(min-width: 640px)').matches ? 3 : 2);
  const [cols, setCols] = useState(get);
  useEffect(() => {
    const h = () => setCols(get());
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return cols;
}
const COL_DEPTH = [0, -0.22, 0.14, -0.3, 0.08];

function Games() {
  const { s } = useStore();
  const [open, setOpen] = useState(null);
  const scene = useRef(null);
  const cols = useCols();
  useParallax(scene, { range: 130, mouse: 0 });
  const t = s.site.text.games;
  if (!s.site.games.length) return null;
  return (
    <section ref={scene} className="gutter mx-auto max-w-6xl pt-24">
      <SectionTitle label={t.label} title={t.title} desc={t.desc} />
      <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {s.site.games.map((g, i) => (
          <div key={g.id} data-depth={COL_DEPTH[i % cols] ?? 0}>
            <GameCover name={g.name} index={i} src={coverSrc(g.cover)} onClick={() => setOpen(g)}>
              <div className="mt-1.5 flex items-baseline gap-2 text-xs" dir="ltr">
                <Mono className="text-zinc-400 line-through">{g.isp}</Mono>
                <Mono className="font-bold text-ok">{bestPing(g)}ms</Mono>
              </div>
            </GameCover>
          </div>
        ))}
      </div>
      {open && <GameDetails g={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

/* ───────────────────────── Traffic calculator ───────────────────────── */

function Calculator() {
  const { s, set } = useStore();
  const games = s.site.games;
  const [picked, setPicked] = useState(() => games.slice(0, 2).map((g) => g.id));
  const [hours, setHours] = useState(3);
  const [days, setDays] = useState(5);
  const t = s.site.text.calculator;
  const chosen = games.filter((g) => picked.includes(g.id));
  // Play time is split evenly across the chosen games.
  const mbPerHour = chosen.length ? chosen.reduce((a, g) => a + g.mb, 0) / chosen.length : 0;
  const gb = (mbPerHour * hours * days * 4.3) / 1024;
  const tier = recommendTier(gb, s.site.pricing);
  const price = priceOf(s.site.pricing, { kind: 'ping', tier, slots: 1, months: 1 }).total;
  const toggle = (id) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  if (!games.length) return null;
  return (
    <section className="gutter mx-auto max-w-6xl pt-24">
      <SectionTitle label={t.label} title={t.title} desc={t.desc} />
      <Card className="mt-8 grid grid-cols-1 overflow-hidden lg:grid-cols-[1fr_20rem]">
        <div className="min-w-0 p-5 sm:p-6">
          <div className="text-xs text-zinc-500">چه بازی‌هایی می‌کنی؟</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {games.map((g) => {
              const on = picked.includes(g.id);
              const src = coverSrc(g.cover);
              return (
                <button
                  key={g.id} type="button" aria-pressed={on} onClick={() => toggle(g.id)}
                  className={cx('flex items-center gap-2 rounded-lg border py-1 ps-1 pe-3 text-xs transition-colors', on ? 'border-white/60 bg-white/10 text-white' : 'border-line text-zinc-400 hover:text-white')}
                >
                  {src ? <img src={src} alt="" className="h-7 w-5 rounded object-cover" /> : <span className="h-7 w-5 rounded bg-raise" />}
                  <Mono>{g.name}</Mono>
                  {on && <Check className="size-3.5" />}
                </button>
              );
            })}
          </div>

          <div className="mt-7 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {[['calc-hours', 'ساعت بازی در روز', hours, setHours, 1, 12], ['calc-days', 'روز در هفته', days, setDays, 1, 7]].map(([id, label, v, setV, min, max]) => (
              <label key={id} className="block">
                <span className="flex items-baseline justify-between text-xs text-zinc-500">{label}<span className="text-lg font-black text-white">{fa(v)}</span></span>
                <input id={id} type="range" min={min} max={max} value={v} onChange={(e) => setV(+e.target.value)} className="mt-2 w-full accent-white" dir="ltr" />
              </label>
            ))}
          </div>
        </div>

        <div className="flex flex-col border-t border-line bg-ink p-5 sm:p-6 lg:border-t-0 lg:border-s">
          <div className="text-xs text-zinc-500">مصرف تقریبی در ماه</div>
          <div className="mt-1 flex items-baseline gap-2" aria-live="polite">
            <Mono className="text-4xl font-black"><CountUp value={chosen.length ? gb : 0} decimals={1} duration={500} format={(n) => n.toFixed(1)} /></Mono>
            <Mono className="text-sm text-zinc-500">GB</Mono>
          </div>
          <div className="mt-5 rounded-xl border border-line p-4">
            <div className="text-xs text-zinc-500">پلن پیشنهادی</div>
            <div className="mt-1 text-lg font-black">{s.site.planNames.ping} · {tierLabel(tier)}</div>
            <div className="text-xs text-zinc-500">ماهانه {toman(price)}</div>
          </div>
          <Btn className="mt-4 w-full" disabled={!chosen.length} onClick={() => { set({ rec: { tier, at: Date.now() } }); jump('pricing'); }}>
            انتخاب این پلن
          </Btn>
          <p className="mt-3 text-[11px] leading-5 text-zinc-600">تخمین بر اساس مصرف معمول هر بازی با ۲۰٪ حاشیه. آپدیت بازی‌ها رو بدون اتصال تانل دانلود کن.</p>
        </div>
      </Card>
    </section>
  );
}

/* ───────────────────────── Game servers ───────────────────────── */

const SORTS = [
  ['fill', 'پرترین'],
  ['ping', 'کمترین پینگ'],
  ['free', 'بیشترین جای خالی'],
];

function ServerRow({ v, open, onToggle, fav, onFav }) {
  const { toast } = useStore();
  const addr = `${v.host}:${v.port}`;
  const full = v.players >= v.max;
  const on = v.status === 'online';
  const steam = v.game !== 'Minecraft';
  const board = [...v.list].sort((a, b) => b.k - a.k);
  return (
    <li className={cx('border-t border-line transition-colors', open && 'bg-white/[0.02]')}>
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-5 lg:grid-cols-[auto_minmax(0,1.4fr)_minmax(0,0.9fr)_9rem_4rem_auto]">
        <ModeEmblem mode={v.mode} vip={v.vip} />
        <button type="button" onClick={onToggle} aria-expanded={open} className="min-w-0 text-start">
          <span className="flex items-center gap-2">
            <Mono className="truncate text-sm font-bold">{v.name}</Mono>
            {v.vip && <Crown className="size-3.5 shrink-0 text-warn" aria-label="VIP" />}
            <ChevronDown className={cx('size-3.5 shrink-0 text-zinc-500 transition-transform', open && 'rotate-180')} />
          </span>
          <span className="flex flex-wrap items-center gap-x-3 text-[11px] text-zinc-500">
            <Mono>{v.tick}</Mono>
            <span className="inline-flex items-center gap-1"><ShieldCheck className="size-3" /><Mono>{v.ac}</Mono></span>
            {!on && <span className="text-brand2">آفلاین</span>}
          </span>
        </button>
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
          <Btn size="md" variant="ghost" icon={Star} aria-label={fav ? 'حذف از علاقه‌مندی‌ها' : 'افزودن به علاقه‌مندی‌ها'} aria-pressed={fav} onClick={onFav} className={fav ? 'text-warn [&_svg]:fill-current' : ''} />
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
      </div>

      {open && (
        <div className="animate-rise px-4 pb-5 sm:px-5 lg:ps-[4.75rem]">
          {board.length ? (
            <div className="overflow-hidden rounded-xl border border-line">
              <div className="flex items-center justify-between bg-ink px-4 py-2 text-xs text-zinc-500">
                <span>جدول امتیاز زنده · <Mono>{v.map}</Mono></span>
                <span className="flex items-center gap-1.5"><Dot /> هر ۳ ثانیه</span>
              </div>
              <div className="max-h-64 overflow-y-auto">
                <table className="w-full text-sm" dir="ltr">
                  <thead><tr className="text-[11px] text-zinc-600"><th className="px-4 py-1.5 text-left font-normal">#</th><th className="text-left font-normal">Player</th><th className="font-normal">K</th><th className="font-normal">D</th><th className="px-4 text-right font-normal">Ping</th></tr></thead>
                  <tbody>
                    {board.map((p, i) => (
                      <tr key={p.name} className="border-t border-line">
                        <td className="px-4 py-1.5 text-zinc-600"><Mono>{i + 1}</Mono></td>
                        <td><Mono className="font-bold">{p.name}</Mono></td>
                        <td className="text-center"><Mono>{p.k}</Mono></td>
                        <td className="text-center text-zinc-500"><Mono>{p.d}</Mono></td>
                        <td className={cx('px-4 text-right', p.ping < 30 ? 'text-ok' : 'text-warn')}><Mono>{p.ping}</Mono></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">{on ? 'سرور الان خالیه. اولین نفر باش.' : 'سرور خاموشه.'}</p>
          )}
        </div>
      )}
    </li>
  );
}

function ServersHub() {
  const { s, set } = useStore();
  const [mode, setMode] = useState('all');
  const [q, setQ] = useState('');
  const [onlyFree, setOnlyFree] = useState(false);
  const [sort, setSort] = useState('fill');
  const [open, setOpen] = useState(null);
  const favs = s.prefs.favs;
  const score = { fill: (v) => -(v.players / v.max), ping: (v) => v.ping, free: (v) => -(v.max - v.players) };
  const list = s.servers
    .filter((v) => mode === 'all' || (mode === 'fav' ? favs.includes(v.id) : v.mode === mode))
    .filter((v) => !onlyFree || v.players < v.max)
    .filter((v) => `${v.name} ${v.map}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (favs.includes(b.id) - favs.includes(a.id)) || score[sort](a) - score[sort](b));
  const modes = [
    ...MODES.filter((m) => m.id === 'all' || s.servers.some((v) => v.mode === m.id)),
    ...(favs.length ? [{ id: 'fav', label: `علاقه‌مندی‌ها (${fa(favs.length)})` }] : []),
  ];
  const toggleFav = (id) => set((p) => ({ prefs: { ...p.prefs, favs: p.prefs.favs.includes(id) ? p.prefs.favs.filter((x) => x !== id) : [...p.prefs.favs, id] } }));
  useEffect(() => { if (mode === 'fav' && !favs.length) setMode('all'); }, [mode, favs.length]);
  // "/" jumps to the server search from anywhere on the page.
  useEffect(() => {
    const h = (e) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, select, [contenteditable]')) return;
      const el = document.getElementById('srv-search');
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ block: 'center' });
      el.focus();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

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
        <select id="srv-sort" value={sort} onChange={(e) => setSort(e.target.value)} aria-label="مرتب‌سازی" className="field w-auto py-2 text-[13px]">
          {SORTS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <div className="relative w-full sm:w-56">
          <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-zinc-600" />
          <input id="srv-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="اسم سرور یا مپ…" className="field pr-9 pl-9" />
          {!q && <kbd className="mono pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 rounded border border-edge px-1.5 text-[11px] text-zinc-500">/</kbd>}
          {q && <button type="button" onClick={() => setQ('')} aria-label="پاک کردن جستجو" className="absolute top-1/2 left-2 grid size-6 -translate-y-1/2 place-items-center rounded text-zinc-500 hover:text-white"><X className="size-3.5" /></button>}
        </div>
      </div>
      <Card className="mt-4 overflow-hidden">
        <div className="hidden grid-cols-[auto_minmax(0,1.4fr)_minmax(0,0.9fr)_9rem_4rem_auto] gap-x-4 px-5 py-3 text-xs text-zinc-500 lg:grid">
          <span className="w-10" /><span>سرور</span><span>مپ</span><span>بازیکن‌ها</span><span>پینگ</span><span className="w-[22rem]" />
        </div>
        {list.length ? (
          <ul className="max-lg:[&>li:first-child]:border-t-0">
            {list.map((v) => <ServerRow key={v.id} v={v} open={open === v.id} onToggle={() => setOpen(open === v.id ? null : v.id)} fav={favs.includes(v.id)} onFav={() => toggleFav(v.id)} />)}
          </ul>
        ) : <p className="p-10 text-center text-sm text-zinc-500">سروری با این فیلتر پیدا نشد.</p>}
      </Card>
      <p className="mt-3 text-xs text-zinc-600">روی اسم هر سرور بزن تا جدول امتیاز زنده‌ش رو ببینی. ستاره، سرور رو بالای لیست نگه می‌داره.</p>
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
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
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
  const P = s.site.pricing;
  const names = s.site.planNames;
  const kinds = ['ping', 'dns', 'pro'].filter((k) => s.site.kinds[k]).map((k) => ({ id: k, label: names[k] }));
  const [kindPick, setKind] = useState(kinds[0]?.id ?? 'ping');
  const kind = kinds.some((k) => k.id === kindPick) ? kindPick : kinds[0]?.id ?? 'ping';
  const periods = durations(P).map((d) => ({ id: d.months, label: `${fa(d.months)} ماهه`, note: d.off ? `${fa(d.off)}٪ تخفیف` : null }));
  const [monthsPick, setMonths] = useState(periods[0]?.id ?? 1);
  const months = periods.some((x) => x.id === monthsPick) ? monthsPick : periods[0]?.id ?? 1;
  const [order, setOrder] = useState(null);
  const isDns = kind === 'dns';
  const options = isDns ? dnsSlots(P) : pingTiers(P);
  const rec = !isDns ? s.rec?.tier : null;
  const popular = isDns ? P.popular?.dns : P.popular?.ping === null ? 'inf' : P.popular?.ping;
  // A recommendation from the calculator switches back to a traffic plan.
  useEffect(() => { if (s.rec && kind === 'dns') setKind(kinds.find((k) => k.id !== 'dns')?.id ?? 'ping'); }, [s.rec?.at]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!kinds.length) return null;

  return (
    <section id="pricing" className="gutter mx-auto max-w-6xl scroll-mt-24 pt-24">
      <SectionTitle label={s.site.text.pricing.label} title={s.site.text.pricing.title} desc={s.site.text.pricing.desc} />
      <div className="mt-8 flex flex-wrap items-center gap-3">
        {kinds.length > 1 && <Tabs tabs={kinds} value={kind} onChange={setKind} />}
        {periods.length > 1 && <Tabs tabs={periods} value={months} onChange={setMonths} />}
      </div>
      <div className={cx('mt-4 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2', options.length >= 5 ? 'lg:grid-cols-5' : options.length === 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3')}>
        {options.map((opt) => {
          const p = priceOf(P, { kind, tier: isDns ? null : opt, slots: isDns ? opt : 1, months });
          const mine = rec != null && opt === rec;
          const hot = rec == null && opt === popular;
          const name = isDns ? `${fa(opt)} آی‌پی` : tierLabel(opt);
          const title = `${names[kind]} · ${name} · ${fa(months)} ماهه`;
          return (
            <Card key={opt} data-plan={opt} className={cx('flex flex-col p-5 transition-colors', (hot || mine) && 'border-zinc-500', mine && 'ring-2 ring-ok/60')}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-zinc-400">{isDns ? 'تعداد آی‌پی' : opt === 'inf' ? 'زمانی' : 'حجمی'}</span>
                {mine ? <Badge tone="ok">پیشنهاد برای تو</Badge> : hot && <Badge tone="brand">پرفروش</Badge>}
              </div>
              <div className="mt-1 text-xl font-black">{name}</div>
              <div className="mt-5 flex items-baseline gap-1.5">
                <CountUp value={p.total / 1000} format={fa} duration={450} className="text-3xl font-black" />
                <span className="text-xs text-zinc-500">هزار تومان</span>
              </div>
              <div className="text-xs text-zinc-600">{months > 1 ? `ماهی ${toman(Math.round(p.total / months / 1000) * 1000)}` : 'ماهانه'}</div>
              <Btn variant={hot || mine ? 'primary' : 'ghost'} className="mt-5 w-full" onClick={() => setOrder({ kind, tier: opt, slots: opt, months, title, ...p })}>فعال‌سازی</Btn>
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

const FAN = [
  { depth: 0.12, rot: -9, cls: 'right-0 top-8 w-[38%]' },
  { depth: 0.42, rot: 6, cls: 'right-[22%] top-0 w-[36%]' },
  { depth: 0.26, rot: -3, cls: 'right-[44%] top-12 w-[34%]' },
  { depth: 0.6, rot: 11, cls: 'right-[63%] top-4 w-[32%]' },
];

function Faq({ go }) {
  const { s, set } = useStore();
  const [open, setOpen] = useState(0);
  const [q, setQ] = useState('');
  const scene = useRef(null);
  useParallax(scene, { range: 120, mouse: 22 });
  const t = s.site.text.faq;
  const term = q.trim();
  const list = s.site.faq.filter((f) => !term || `${f.q} ${f.a}`.includes(term));
  const covers = s.site.games.map((g) => coverSrc(g.cover)).filter(Boolean).slice(0, 4);
  if (!s.site.faq.length) return null;
  return (
    <section ref={scene} id="faq" className="relative isolate overflow-clip pt-24 pb-6">
      {/* depth layers: a giant question mark and a crimson glow drift at different speeds */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10">
        <div data-depth="-0.7" className="absolute top-0 left-[3%] text-[clamp(14rem,36vw,32rem)] leading-none font-black text-white/[0.035] select-none">؟</div>
        <div data-depth="0.4" className="absolute top-[18%] right-[-10rem] size-[22rem] rounded-full bg-brand/[0.07] blur-3xl" />
      </div>

      <div className="gutter mx-auto grid max-w-6xl grid-cols-1 gap-10 lg:grid-cols-[22rem_1fr] lg:gap-16">
        <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <div className="relative z-10"><SectionTitle label={t.label} title={t.title} desc={t.desc} /></div>
          {covers.length > 0 && (
            <div className="relative mt-10 h-44 sm:h-60" aria-hidden="true">
              {covers.map((src, i) => (
                <div key={i} data-depth={FAN[i].depth} className={cx('absolute', FAN[i].cls)}>
                  <img src={src} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-xl border border-line object-cover shadow-2xl shadow-black" style={{ transform: `rotate(${FAN[i].rot}deg)` }} />
                </div>
              ))}
            </div>
          )}
          <div className="relative z-10 mt-8">
            <Search className="absolute top-1/2 right-3 size-4 -translate-y-1/2 text-zinc-600" />
            <input id="faq-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="جستجو در پرسش‌ها…" className="field pr-9" />
          </div>
          <Btn variant="ghost" icon={MessageCircleQuestion} className="mt-3" onClick={() => { set({ panelTab: 'support' }); go('panel'); }}>
            سؤالت اینجا نیست؟ تیکت بزن
          </Btn>
        </div>

        <div className="flex flex-col gap-2" aria-live="polite">
          {list.map((f) => {
            const i = s.site.faq.indexOf(f);
            const isOpen = open === i;
            return (
              <Card key={f.id} className={cx('transition-colors', isOpen && 'border-edge')}>
                <button
                  type="button" onClick={() => setOpen(isOpen ? -1 : i)} aria-expanded={isOpen} aria-controls={`faq-a-${f.id}`}
                  className="flex w-full items-center gap-3 px-5 py-4 text-start text-sm font-bold"
                >
                  <span className="flex-1">{f.q}</span>
                  <span className={cx('grid size-6 shrink-0 place-items-center rounded-full border transition duration-300', isOpen ? 'rotate-180 border-zinc-500 text-white' : 'border-line text-zinc-500')}>
                    <ChevronDown className="size-3.5" />
                  </span>
                </button>
                <div id={`faq-a-${f.id}`} inert={!isOpen} className={cx('grid transition-[grid-template-rows] duration-300 ease-out', isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]')}>
                  <div className="overflow-hidden">
                    <p className="px-5 pb-5 text-sm leading-7 whitespace-pre-line text-zinc-400">{f.a}</p>
                  </div>
                </div>
              </Card>
            );
          })}
          {!list.length && <Card className="p-8 text-center text-sm text-zinc-500">پرسشی با «{term}» پیدا نشد.</Card>}
        </div>
      </div>
    </section>
  );
}

/** Closing call to action. The logo's speed bars slide across as it scrolls past. */
function Closing({ go }) {
  const { s } = useStore();
  const { show, text, hero } = s.site;
  const scene = useRef(null);
  useParallax(scene, { range: 300, mouse: 12 });
  return (
    <section ref={scene} className="gutter mx-auto max-w-6xl pt-24">
      <div className="relative isolate overflow-hidden rounded-2xl border border-line bg-card px-6 py-16 text-center">
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 -z-10 flex w-[62%] flex-col justify-center gap-3" dir="ltr">
          {[['72%', 0.55], ['48%', 1.15], ['100%', 0.8], ['84%', 1.45]].map(([w, d], i) => (
            <div key={i} data-depth={d} data-axis="x" className="h-5 rounded-r-full bg-brand/30 sm:h-7" style={{ width: w, marginLeft: '-22%' }} />
          ))}
        </div>
        <h2 className="text-2xl font-black sm:text-4xl">{text.cta.title}</h2>
        {text.cta.desc && <p className="mx-auto mt-3 max-w-md text-sm text-zinc-400">{text.cta.desc}</p>}
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {show.pricing && <Btn size="lg" onClick={() => jump('pricing')}>{hero.cta1}</Btn>}
          <Btn size="lg" variant="ghost" onClick={() => go('panel')}>ورود به پنل</Btn>
        </div>
      </div>
    </section>
  );
}

export default function Storefront({ go }) {
  const { s } = useStore();
  const { show, order } = s.site;
  // Sections render in the order chosen in Admin → «تنظیمات سایت».
  const SECTIONS = {
    ping: () => <PingSection />,
    games: () => <Games />,
    calculator: () => show.pricing && <Calculator />,
    servers: () => <ServersHub />,
    pricing: () => <Pricing go={go} />,
    faq: () => <Faq go={go} />,
    cta: () => <Closing go={go} />,
  };
  return (
    <>
      <Hero />
      {order.map((k) => show[k] !== false && SECTIONS[k] && <div key={k} data-section={k}>{SECTIONS[k]()}</div>)}
    </>
  );
}
