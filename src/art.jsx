// Small vector pieces: original game covers, the quota ring, and the cluster diagram.
import { Blocks, Bomb, Crosshair, Hammer, Swords, Target } from 'lucide-react';
import { useTilt } from './motion.jsx';

/* ───────────────────────── Game covers (original artwork, not publisher art) ───────────────────────── */

const S = { fill: 'none', stroke: '#fff', strokeOpacity: 0.16, strokeWidth: 1 };
const PATTERNS = [
  <>{[18, 34, 50, 66, 82].map((r) => <circle key={r} cx="96" cy="34" r={r} {...S} />)}</>,
  <>{Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${-40 + i * 16} 110L${20 + i * 16} -10`} {...S} />)}</>,
  <>{Array.from({ length: 7 }, (_, r) => Array.from({ length: 7 }, (_, c) => <circle key={`${r}${c}`} cx={12 + c * 16} cy={10 + r * 14} r="1.4" fill="#fff" fillOpacity={0.1 + (r + c) * 0.02} />))}</>,
  <>{[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${10 + i * 6} ${96 - i * 16}L60 ${56 - i * 16}L${110 - i * 6} ${96 - i * 16}`} {...S} />)}</>,
  <>{[0, 1, 2, 3, 4].map((i) => <rect key={i} x={20 + i * 9} y={6 + i * 9} width={80 - i * 18} height={80 - i * 18} {...S} />)}</>,
  <>{[0, 1, 2, 3, 4, 5, 6].map((i) => <path key={i} d={`M0 ${14 + i * 13}Q30 ${4 + i * 13} 60 ${14 + i * 13}T120 ${14 + i * 13}`} {...S} />)}</>,
  <><path d="M60 6L112 96H8z" {...S} /><path d="M60 30L92 86H28z" {...S} /><path d="M60 52L74 78H46z" {...S} /></>,
  <>{[0, 1, 2, 3, 4, 5].map((i) => <path key={i} d={`M${i * 24} 0V100M0 ${i * 20}H120`} {...S} strokeOpacity="0.09" />)}<circle cx="72" cy="40" r="22" {...S} /></>,
  <>{[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${-10 + i * 14} 100A${70 - i * 6} ${70 - i * 6} 0 0 1 ${110 - i * 2} ${-6 + i * 4}`} {...S} />)}</>,
  <>{[[14, 14], [50, 14], [86, 14], [32, 50], [68, 50], [50, 86]].map(([x, y]) => <rect key={`${x}${y}`} x={x} y={y} width="26" height="26" rx="3" {...S} />)}</>,
];

/**
 * Game cover card. With `src` it shows the game's artwork; without one it draws a quiet line pattern.
 * With `onClick` the whole card is a button.
 */
export function GameCover({ name, index = 0, src, children, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  const tilt = useTilt(10);
  return (
    <Tag
      ref={tilt}
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      aria-label={onClick ? `جزئیات ${name}` : undefined}
      className="tilt group relative block aspect-[2/3] w-full overflow-hidden rounded-2xl border border-line bg-card text-start hover:border-zinc-500"
    >
      {src ? (
        <img src={src} alt={onClick ? '' : name} loading="lazy" className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105" />
      ) : (
        <svg viewBox="0 0 120 100" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 size-full" aria-hidden="true">
          {PATTERNS[index % PATTERNS.length]}
        </svg>
      )}
      {(children || !src) && (
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-3 pt-12">
          <div className="mono truncate text-sm leading-tight font-bold text-white" dir="ltr">{name}</div>
          {children}
        </div>
      )}
      {onClick && <span className="absolute top-2 left-2 rounded-md bg-black/70 px-2 py-0.5 text-[11px] text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">جزئیات</span>}
    </Tag>
  );
}

/* ───────────────────────── Quota ring ───────────────────────── */

/** One thin ring. `pct` is the share already used. */
export function Ring({ pct, children, className }) {
  const R = 54;
  const C = 2 * Math.PI * R;
  const v = Math.max(0, Math.min(100, pct));
  const color = v >= 90 ? '#FF1E27' : v >= 70 ? '#F59E0B' : '#fff';
  return (
    <div className={`relative aspect-square ${className ?? ''}`}>
      <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-hidden="true">
        <circle cx="60" cy="60" r={R} fill="none" stroke="#1f1f26" strokeWidth="5" />
        <circle cx="60" cy="60" r={R} fill="none" stroke={color} strokeWidth="5" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (v / 100)} style={{ transition: 'stroke-dashoffset .8s ease' }} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/** Label, value and a thin bar. Used for CPU / RAM. */
export function ArcMeter({ value, label }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs" dir="ltr">
        <span className="mono text-zinc-500">{label}</span>
        <span className={`mono font-bold ${v >= 85 ? 'text-brand2' : v >= 65 ? 'text-warn' : 'text-white'}`}>{value}%</span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-line" dir="ltr">
        <div className={`h-full rounded-full transition-[width] duration-700 ${v >= 85 ? 'bg-brand2' : v >= 65 ? 'bg-warn' : 'bg-white'}`} style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

const MODE_ICON = { retake: Bomb, '5v5': Swords, dm: Crosshair, aim: Target, rust: Hammer, mc: Blocks };
export function ModeEmblem({ mode, vip, className = 'size-10' }) {
  const Icon = MODE_ICON[mode] ?? Crosshair;
  return (
    <span className={`grid shrink-0 place-items-center rounded-xl border bg-raise ${vip ? 'border-warn/50 text-warn' : 'border-line text-zinc-300'} ${className}`} aria-hidden="true">
      <Icon className="size-[45%]" />
    </span>
  );
}

/* ───────────────────────── Cluster diagram ───────────────────────── */

const EXIT_NAME = { dxb: 'دبی', mct: 'مسقط', fra: 'فرانکفورت' };
const sans = { fontFamily: 'var(--font-sans)' };
const mono = { fontFamily: 'var(--font-mono)' };

/** Entry routers on the right, exit routers on the left, one thin link per pair. `status` maps code → {tone, sub}. */
export function RouteMap({ status = {}, className }) {
  const entries = [['thr', 90, 'تهران'], ['shz', 210, 'شیراز']].filter(([k]) => status[k]);
  const exits = [['dxb', 50], ['mct', 150], ['fra', 250]].filter(([k]) => status[k]);
  const col = (t) => (t === 'bad' ? '#FF1E27' : t === 'warn' ? '#F59E0B' : '#10B981');
  return (
    <svg viewBox="0 0 1000 300" className={className} role="img" aria-label="توپولوژی کلاستر" style={{ direction: 'ltr' }}>
      {entries.flatMap(([a, ya]) => exits.map(([e, ye]) => {
        const up = status[a].tone !== 'bad' && status[e].tone !== 'bad';
        return <path key={a + e} d={`M720 ${ya}C560 ${ya} 480 ${ye} 320 ${ye}`} fill="none" stroke={up ? '#3f3f46' : '#FF1E27'} strokeOpacity={up ? 1 : 0.5} strokeWidth="1.5" strokeDasharray={up ? undefined : '3 6'} />;
      }))}
      {entries.map(([k, y, name]) => (
        <g key={k}>
          <circle cx="720" cy={y} r="6" fill={col(status[k].tone)} />
          <text x="740" y={y - 1} fill="#fff" fontSize="16" fontWeight="600" style={sans}>{name}</text>
          <text x="740" y={y + 17} fill="#71717A" fontSize="12" style={mono}>{status[k].sub}</text>
        </g>
      ))}
      {exits.map(([k, y]) => (
        <g key={k}>
          <circle cx="320" cy={y} r="6" fill={col(status[k].tone)} />
          <text x="300" y={y - 1} textAnchor="end" fill="#fff" fontSize="16" fontWeight="600" style={sans}>{EXIT_NAME[k]}</text>
          <text x="300" y={y + 17} textAnchor="end" fill="#71717A" fontSize="12" style={mono}>{status[k].sub}</text>
        </g>
      ))}
    </svg>
  );
}
