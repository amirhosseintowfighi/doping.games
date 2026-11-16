// Bespoke vector art for Doping: routing map, CS2 mode emblems and HUD telemetry gauges.
import { useId, useMemo } from 'react';

const RED = '#FF1E27';
const OK = '#10B981';
const WARN = '#F59E0B';

/* ───────────────────────── Network routing map ───────────────────────── */

const NODES = {
  you: { x: 492, y: 258, code: 'YOU', label: 'شما' },
  thr: { x: 596, y: 150, code: 'THR', label: 'تهران' },
  shz: { x: 640, y: 248, code: 'SHZ', label: 'شیراز' },
  dxb: { x: 752, y: 292, code: 'DXB', label: 'دبی' },
  mct: { x: 872, y: 330, code: 'MCT', label: 'مسقط' },
  fra: { x: 168, y: 92, code: 'FRA', label: 'فرانکفورت' },
  dc: { x: 648, y: 362, code: 'DC', label: 'سرور بازی' },
};
const curve = (a, b, bend = 0.18) => {
  const mx = (a.x + b.x) / 2 - (b.y - a.y) * bend;
  const my = (a.y + b.y) / 2 + (b.x - a.x) * bend;
  return `M${a.x} ${a.y}Q${mx} ${my} ${b.x} ${b.y}`;
};
const DC_BEND = { mct: 0.3, dxb: 0.25, fra: -0.2 };

function MapNode({ n, tone = 'idle', sub, big }) {
  const c = tone === 'active' ? RED : tone === 'ok' ? OK : tone === 'bad' ? RED : tone === 'warn' ? WARN : '#71717A';
  const lit = tone !== 'idle';
  const left = n.x < 300 || n.code === 'YOU' || n.code === 'DC' || n.y > 355;
  const off = big ? 32 : 24;
  return (
    <g>
      {lit && <circle cx={n.x} cy={n.y} r={big ? 24 : 17} fill={c} opacity="0.07" className="animate-breathe" />}
      <circle cx={n.x} cy={n.y} r={big ? 13 : 9} fill="#050507" stroke={c} strokeOpacity={lit ? 0.9 : 0.5} />
      <circle cx={n.x} cy={n.y} r={big ? 4 : 3} fill={lit ? c : '#52525B'} />
      {tone === 'bad' && <path d={`M${n.x - 5} ${n.y - 5}l10 10m0-10l-10 10`} stroke="#050507" strokeWidth="2" />}
      <text x={n.x + (left ? -off : off)} y={n.y - 3} textAnchor={left ? 'end' : 'start'} fill="#fff" fontSize="13" fontWeight="600" style={{ fontFamily: 'var(--font-mono)', letterSpacing: '.14em' }}>{n.code}</text>
      <text x={n.x + (left ? -off : off)} y={n.y + 13} textAnchor={left ? 'end' : 'start'} fill="#71717A" fontSize="11" style={{ fontFamily: sub ? 'var(--font-mono)' : 'var(--font-sans)' }}>{sub ?? n.label}</text>
    </g>
  );
}

function Tag({ x, y, text, color }) {
  const w = text.length * 7.4 + 18;
  return (
    <g transform={`translate(${x - w / 2} ${y - 11})`}>
      <rect width={w} height="22" rx="11" fill="#08080B" stroke={color} strokeOpacity="0.55" />
      <text x={w / 2} y="15" textAnchor="middle" fill={color} fontSize="11.5" fontWeight="600" style={{ fontFamily: 'var(--font-mono)' }}>{text}</text>
    </g>
  );
}

/**
 * mode="route": the gamer's path. Crimson = Doping tunnel through `exit`, amber dashes = the ISP detour.
 * mode="topology": the whole cluster with live router status (`status` maps node code → {tone, sub}).
 */
export function RouteMap({ mode = 'route', exit = 'mct', ping, ispPing, dcLabel = 'GAME DC', status = {}, className }) {
  const id = useId();
  const N = NODES;
  const exits = ['mct', 'dxb', 'fra'];
  const isp = `M${N.you.x} ${N.you.y}C380 300 250 250 215 160S330 30 470 70S640 300 ${N.dc.x} ${N.dc.y}`;
  const hot = curve(N.thr, N[exit], exit === 'fra' ? -0.12 : 0.16);
  const out = curve(N[exit], N.dc, DC_BEND[exit]);
  const tone = (k) => status[k]?.tone ?? 'ok';
  return (
    <svg viewBox="0 0 1000 420" className={className} role="img" aria-label="نقشه مسیر شبکه دوپینگ" style={{ direction: 'ltr' }}>
      <defs>
        <pattern id={`${id}d`} width="16" height="16" patternUnits="userSpaceOnUse"><circle cx="1.2" cy="1.2" r="1.1" fill="#fff" opacity="0.07" /></pattern>
        <radialGradient id={`${id}f`} cx="62%" cy="48%" r="62%"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
        <mask id={`${id}m`}><rect width="1000" height="420" fill={`url(#${id}f)`} /></mask>
        <linearGradient id={`${id}g`} x1="0" x2="1"><stop offset="0" stopColor="#FF1E27" stopOpacity="0.25" /><stop offset="1" stopColor="#FF1E27" /></linearGradient>
        <filter id={`${id}b`} x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="5" /></filter>
      </defs>
      <rect width="1000" height="420" fill={`url(#${id}d)`} mask={`url(#${id}m)`} />
      {/* graticule + radar rings around the Tehran edge */}
      <g fill="none" stroke="#fff" strokeOpacity="0.05">
        <path d="M0 150Q500 60 1000 150M0 260Q500 170 1000 260M0 370Q500 280 1000 370" />
        {[70, 130, 200, 290].map((r) => <circle key={r} cx={N.thr.x} cy={N.thr.y} r={r} strokeDasharray="2 7" />)}
      </g>

      {mode === 'route' ? (
        <>
          <path d={isp} fill="none" stroke={WARN} strokeOpacity="0.5" strokeWidth="1.2" strokeDasharray="3 7" />
          {exits.filter((e) => e !== exit).map((e) => <path key={e} d={curve(N.thr, N[e], e === 'fra' ? -0.12 : 0.16)} fill="none" stroke="#fff" strokeOpacity="0.1" />)}
          <g fill="none" strokeLinecap="round">
            <path d={`${curve(N.you, N.thr, -0.2)}${hot.replace('M', 'L')}`} stroke={RED} strokeWidth="7" opacity="0.35" filter={`url(#${id}b)`} />
            <path d={curve(N.you, N.thr, -0.2)} stroke={`url(#${id}g)`} strokeWidth="1.6" />
            <path d={hot} stroke={RED} strokeWidth="1.6" />
            <path d={hot} stroke="#fff" strokeWidth="1.6" strokeDasharray="2 26" className="animate-flow" />
            <path d={out} stroke={OK} strokeWidth="1.3" strokeDasharray="5 5" />
          </g>
          <circle r="3.5" fill="#fff"><animateMotion dur="2.2s" repeatCount="indefinite" path={hot} /></circle>
          {exits.map((e) => <MapNode key={e} n={N[e]} tone={e === exit ? 'active' : 'idle'} />)}
          <MapNode n={N.thr} tone="active" big sub="EDGE · IR" />
          <MapNode n={N.you} tone="ok" />
          <MapNode n={{ ...N.dc, code: dcLabel }} tone="ok" sub="GAME SERVER" />
          {ispPing != null && <Tag x={300} y={78} text={`ISP ${ispPing} ms`} color={WARN} />}
          {ping != null && <Tag x={exit === 'fra' ? 400 : (N.thr.x + N[exit].x) / 2 + 34} y={exit === 'fra' ? 96 : (N.thr.y + N[exit].y) / 2 - 22} text={`DOPING ${ping} ms`} color={RED} />}
        </>
      ) : (
        <>
          {['thr', 'shz'].flatMap((a) => exits.map((e) => {
            const up = tone(a) !== 'bad' && tone(e) !== 'bad';
            const d = curve(N[a], N[e], e === 'fra' ? -0.12 : 0.14);
            return (
              <g key={a + e} fill="none">
                <path d={d} stroke={up ? RED : '#52525B'} strokeOpacity={up ? 0.55 : 0.35} strokeWidth="1.2" strokeDasharray={up ? undefined : '3 6'} />
                {up && <path d={d} stroke="#fff" strokeOpacity="0.8" strokeWidth="1.2" strokeDasharray="2 26" className="animate-flow" />}
              </g>
            );
          }))}
          {['thr', 'shz', ...exits].map((k) => status[k] && <MapNode key={k} n={N[k]} tone={tone(k)} sub={status[k].sub} big={k === 'thr' || k === 'shz'} />)}
        </>
      )}
    </svg>
  );
}

/* ───────────────────────── CS2 / game mode emblems ───────────────────────── */

const GLYPH = {
  // bomb-site diamond with corner brackets
  retake: <><path d="M32 17l15 15-15 15-15-15z" /><path d="M32 25v14M25 32h14" /><path d="M12 22v-6h6M52 22v-6h-6M12 42v6h6M52 42v6h-6" opacity=".5" /></>,
  // two squads of five, facing
  '5v5': <><path d="M17 18l9 14-9 14M23 18l9 14-9 14" /><path d="M47 18l-9 14 9 14M41 18l-9 14 9 14" opacity=".55" /></>,
  // free-for-all crosshair
  dm: <><circle cx="32" cy="32" r="11" /><path d="M32 13v10M32 41v10M13 32h10M41 32h10" /><circle cx="32" cy="32" r="1.6" fill="currentColor" /></>,
  // target rings with a tracer
  aim: <><circle cx="32" cy="32" r="15" opacity=".45" /><circle cx="32" cy="32" r="8.5" /><circle cx="32" cy="32" r="2" fill="currentColor" /><path d="M50 14L37 27M50 14h-7M50 14v7" /></>,
  // hex bolt
  rust: <><path d="M32 16l14 8v16l-14 8-14-8V24z" /><circle cx="32" cy="32" r="6" /><path d="M18 24l14 8 14-8" opacity=".4" /></>,
  // isometric block
  mc: <><path d="M32 15l15 8.5v17L32 49l-15-8.5v-17z" /><path d="M17 23.5L32 32l15-8.5M32 32v17" /></>,
};

/** Hexagonal crest with a specular rim; the glyph is specific to the server's game mode. */
export function ModeEmblem({ mode, vip, className = 'size-14' }) {
  const id = useId();
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={`${id}r`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.55" /><stop offset="0.45" stopColor="#fff" stopOpacity="0.08" /><stop offset="1" stopColor={vip ? WARN : RED} stopOpacity="0.9" />
        </linearGradient>
        <radialGradient id={`${id}c`} cx="50%" cy="25%" r="80%"><stop offset="0" stopColor={vip ? WARN : RED} stopOpacity="0.22" /><stop offset="1" stopColor="#000" stopOpacity="0" /></radialGradient>
      </defs>
      <path d="M32 2.5l25.5 14.75v29.5L32 61.5 6.5 46.75v-29.5z" fill={`url(#${id}c)`} stroke={`url(#${id}r)`} />
      <g fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" color="#fff">{GLYPH[mode] ?? GLYPH.dm}</g>
    </svg>
  );
}

/* ───────────────────────── HUD telemetry ───────────────────────── */

const polar = (cx, cy, r, deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
const toneOf = (pct) => (pct >= 90 ? RED : pct >= 70 ? WARN : OK);

/** 270° tick-ring gauge. `pct` is the consumed share; the lit ticks change colour as it fills. */
export function TickRing({ pct, children, className, color }) {
  const TICKS = 72;
  const c = color ?? toneOf(pct);
  const lit = Math.round((Math.min(100, Math.max(0, pct)) / 100) * TICKS);
  const [ax, ay] = polar(120, 120, 78, 135);
  const [bx, by] = polar(120, 120, 78, 45);
  return (
    <div className={`relative aspect-square ${className ?? ''}`}>
      <svg viewBox="0 0 240 240" className="size-full" aria-hidden="true">
        <circle cx="120" cy="120" r="118" fill="none" stroke="#fff" strokeOpacity="0.05" />
        <path d={`M${ax} ${ay}A78 78 0 1 1 ${bx} ${by}`} fill="none" stroke="#fff" strokeOpacity="0.08" />
        {Array.from({ length: TICKS + 1 }, (_, i) => {
          const deg = 135 + (270 / TICKS) * i;
          const major = i % 9 === 0;
          const [x1, y1] = polar(120, 120, major ? 90 : 94, deg);
          const [x2, y2] = polar(120, 120, 106, deg);
          const on = i < lit;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={on ? c : '#fff'} strokeOpacity={on ? 1 : 0.13} strokeWidth={major ? 2 : 1.3} strokeLinecap="round" style={on ? { filter: `drop-shadow(0 0 4px ${c})` } : undefined} />;
        })}
        <path d="M120 232v-8M112 228h16" stroke="#fff" strokeOpacity="0.25" />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** Half-circle meter for CPU / RAM style readings. */
export function ArcMeter({ value, label }) {
  const v = Math.max(0, Math.min(100, value));
  const c = v >= 85 ? RED : v >= 65 ? WARN : OK;
  const L = Math.PI * 34;
  return (
    <div className="relative">
      <svg viewBox="0 0 84 50" className="w-full" aria-hidden="true">
        <path d="M8 44A34 34 0 0 1 76 44" fill="none" stroke="#fff" strokeOpacity="0.08" strokeWidth="3" strokeLinecap="round" />
        <path d="M8 44A34 34 0 0 1 76 44" fill="none" stroke={c} strokeWidth="3" strokeLinecap="round" strokeDasharray={L} strokeDashoffset={L * (1 - v / 100)} style={{ transition: 'stroke-dashoffset .8s ease', filter: `drop-shadow(0 0 5px ${c})` }} />
      </svg>
      <div className="absolute inset-x-0 bottom-0 text-center leading-none">
        <span className="mono text-sm font-black">{value}%</span>
        <span className="eyebrow mt-1 block">{label}</span>
      </div>
    </div>
  );
}

/** Player slots as individual pips: reads as "seats", not as a generic progress bar. */
export function Pips({ value, max, cells = 20 }) {
  const n = Math.min(cells, max);
  const lit = Math.round((value / max) * n);
  const full = value >= max;
  return (
    <div className="flex gap-[3px]" dir="ltr" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className="h-2 flex-1 rounded-[2px] transition-colors duration-500" style={{ background: i < lit ? (full ? RED : value / max > 0.8 ? WARN : OK) : 'rgba(255,255,255,0.08)', boxShadow: i < lit ? `0 0 8px ${full ? RED : value / max > 0.8 ? WARN : OK}66` : undefined }} />
      ))}
    </div>
  );
}

/** Latency trace. Deterministic per seed, so it only moves when the reading does. */
export function Wave({ seed = 1, color = OK, jitter = 3, className = 'h-8 w-full' }) {
  const d = useMemo(() => {
    let s = seed * 9301 + 49297;
    const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
    let p = 'M0 16';
    for (let x = 6; x <= 120; x += 6) p += `L${x} ${(16 + (r() - 0.5) * jitter * 2).toFixed(1)}`;
    return p;
  }, [seed, jitter]);
  return (
    <svg viewBox="0 0 120 32" preserveAspectRatio="none" className={className} aria-hidden="true">
      <path d={d} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </svg>
  );
}

/** Corner brackets that turn any block into a HUD viewport. */
export const Brackets = () => (
  <div className="pointer-events-none absolute inset-3" aria-hidden="true">
    {['top-0 left-0 border-t border-l', 'top-0 right-0 border-t border-r', 'bottom-0 left-0 border-b border-l', 'bottom-0 right-0 border-b border-r'].map((c) => (
      <span key={c} className={`absolute size-3.5 border-white/25 ${c}`} />
    ))}
  </div>
);
