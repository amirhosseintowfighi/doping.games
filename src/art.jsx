// Vector art for Doping. Everything here is drawn in the logo's own vocabulary:
// thick round-capped bars, the right lean, and flat crimson / white on obsidian.
const RED = '#E60012';
const OK = '#10B981';
const WARN = '#F59E0B';
const sans = { fontFamily: 'var(--font-sans)' };
const mono = { fontFamily: 'var(--font-mono)' };

/* ───────────────────────── Speed bars (the logo trail at architectural scale) ───────────────────────── */

/** Four bars entering from the left edge, same rhythm as the trail on the D: medium, short, long, dashes. */
export function SpeedBars({ className, dim }) {
  const bar = 'h-[clamp(1.05rem,4.4vw,3.6rem)] rounded-r-full';
  const style = { background: dim ? '#5c0008' : RED };
  return (
    <div className={`pointer-events-none flex flex-col gap-[clamp(.4rem,1vw,.8rem)] ${className ?? ''}`} dir="ltr" aria-hidden="true">
      <div className={bar} style={{ ...style, width: '74%' }} />
      <div className={bar} style={{ ...style, width: '52%' }} />
      <div className={bar} style={{ ...style, width: '100%' }} />
      <div className="flex gap-[clamp(.4rem,1vw,.8rem)]" style={{ width: '88%' }}>
        <div className={`${bar} flex-1`} style={style} />
        <div className={`${bar} aspect-[1.6] rounded-full`} style={style} />
        <div className={`${bar} aspect-[2.4] rounded-full`} style={style} />
      </div>
    </div>
  );
}

/** Three small bars used as the mark in front of a section title. */
export const TitleMark = () => (
  <svg viewBox="0 0 44 26" className="h-[0.62em] shrink-0" aria-hidden="true" style={{ direction: 'ltr' }}>
    <g stroke={RED} strokeWidth="6" strokeLinecap="round"><path d="M14 4h26M4 13h36M20 22h20" /></g>
  </svg>
);

/* ───────────────────────── Route map, drawn like a transit diagram ───────────────────────── */

const EXIT_Y = { dxb: 120, mct: 190, fra: 260 };
const EXIT_NAME = { dxb: 'دبی', mct: 'مسقط', fra: 'فرانکفورت' };
const branch = (y) => { const a = Math.abs(y - 190); return `M700 190L${700 - a} ${y}H${250 + a}L250 190`; };
const ISP = 'M930 190L880 140V84L836 40H640L610 66H430L400 40H244L200 84V140L150 190';
const HOPS = [[880, 140], [880, 100], [836, 40], [770, 40], [700, 40], [640, 40], [610, 66], [520, 66], [430, 66], [400, 40], [320, 40], [244, 40], [200, 84], [200, 140]];

const Stop = ({ x, y, r = 9, on = true, core }) => (
  <g>
    <circle cx={x} cy={y} r={r + 3} fill="#050507" />
    <circle cx={x} cy={y} r={r} fill={on ? '#fff' : '#050507'} stroke={on ? '#fff' : '#52525B'} strokeWidth="2" />
    {core && <circle cx={x} cy={y} r={r - 5} fill={core} />}
  </g>
);

/**
 * mode="route": the gamer's trip reads right-to-left. The thick crimson line is the Doping tunnel through
 * the chosen exit; the thin amber line with 14 stops is the ordinary ISP detour.
 * mode="topology": entry routers on the right, exit routers on the left, one link per pair.
 */
export function RouteMap({ mode = 'route', exit = 'mct', dcLabel = 'GAME DC', status = {}, className }) {
  if (mode === 'topology') {
    const entries = [['thr', 130, 'تهران'], ['shz', 270, 'شیراز']].filter(([k]) => status[k]);
    const exits = [['dxb', 80], ['mct', 200], ['fra', 320]].filter(([k]) => status[k]);
    const tone = (k) => status[k].tone;
    return (
      <svg viewBox="0 0 1000 400" className={className} role="img" aria-label="توپولوژی کلاستر" style={{ direction: 'ltr' }}>
        {entries.flatMap(([a, ya]) => exits.map(([e, ye]) => {
          const up = tone(a) !== 'bad' && tone(e) !== 'bad';
          const d = `M740 ${ya}H640L${640 - Math.abs(ye - ya)} ${ye}H300`;
          return (
            <g key={a + e} fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d={d} stroke={up ? RED : '#3F3F46'} strokeWidth={up ? 5 : 2} strokeDasharray={up ? undefined : '2 9'} />
              {up && <path d={d} stroke="#fff" strokeWidth="1.5" strokeDasharray="4 30" className="animate-flow" />}
            </g>
          );
        }))}
        {entries.map(([k, y, name]) => (
          <g key={k}>
            <rect x="728" y={y - 16} width="24" height="32" rx="12" fill="#fff" stroke="#050507" strokeWidth="4" />
            {tone(k) !== 'ok' && <circle cx="740" cy={y} r="5" fill={tone(k) === 'bad' ? RED : WARN} />}
            <text x="772" y={y - 2} fill="#fff" fontSize="19" fontWeight="900" style={sans}>{name}</text>
            <text x="772" y={y + 17} fill={tone(k) === 'bad' ? '#FF1E27' : '#8B8B95'} fontSize="12" style={mono}>{status[k].sub}</text>
          </g>
        ))}
        {exits.map(([k, y]) => (
          <g key={k}>
            <Stop x={300} y={y} on={tone(k) !== 'bad'} core={tone(k) === 'bad' ? RED : tone(k) === 'warn' ? WARN : undefined} />
            <text x="278" y={y - 2} textAnchor="end" fill={tone(k) === 'bad' ? '#71717A' : '#fff'} fontSize="19" fontWeight="900" style={sans}>{EXIT_NAME[k]}</text>
            <text x="278" y={y + 17} textAnchor="end" fill={tone(k) === 'bad' ? '#FF1E27' : '#8B8B95'} fontSize="12" style={mono}>{status[k].sub}</text>
          </g>
        ))}
      </svg>
    );
  }

  const y = EXIT_Y[exit];
  const active = `M930 190H700${branch(y).slice(8)}H150`;
  return (
    <svg viewBox="0 0 1000 310" className={className} role="img" aria-label="نقشه مسیر: دوپینگ در برابر اینترنت معمولی" style={{ direction: 'ltr' }}>
      {/* ISP: long way round, every hop is a stop */}
      <path d={ISP} fill="none" stroke={WARN} strokeWidth="2" strokeLinejoin="round" />
      {HOPS.map(([hx, hy]) => <circle key={`${hx}-${hy}`} cx={hx} cy={hy} r="4" fill="#050507" stroke={WARN} strokeWidth="2" />)}
      <text x="520" y="26" textAnchor="middle" fill={WARN} fontSize="13" fontWeight="700" style={sans}>اینترنت معمولی · ۱۴ هاپ</text>

      {/* idle exits */}
      {Object.entries(EXIT_Y).filter(([k]) => k !== exit).map(([k, ey]) => <path key={k} d={branch(ey)} fill="none" stroke="#3F3F46" strokeWidth="3" strokeLinejoin="round" />)}
      {/* the tunnel */}
      <path d={active} fill="none" stroke={RED} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      <path d={active} fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeDasharray="4 30" className="animate-flow" />

      {Object.entries(EXIT_Y).map(([k, ey]) => (
        <g key={k}>
          <Stop x={475} y={ey} on={k === exit} />
          <text x="475" y={ey - 18} textAnchor="middle" fill={k === exit ? '#fff' : '#63636E'} fontSize={k === exit ? 17 : 14} fontWeight="900" style={sans}>{EXIT_NAME[k]}</text>
        </g>
      ))}
      <rect x="758" y="170" width="24" height="40" rx="12" fill="#fff" stroke="#050507" strokeWidth="4" />
      <text x="770" y="238" textAnchor="middle" fill="#fff" fontSize="17" fontWeight="900" style={sans}>نود تهران</text>
      <Stop x={930} y={190} r={11} core={RED} />
      <text x="930" y="238" textAnchor="middle" fill="#fff" fontSize="17" fontWeight="900" style={sans}>شما</text>
      <Stop x={150} y={190} r={11} core={OK} />
      <text x="150" y="238" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="700" style={mono}>{dcLabel}</text>
      <text x="150" y="256" textAnchor="middle" fill="#8B8B95" fontSize="12" style={sans}>سرور بازی</text>
    </svg>
  );
}

/* ───────────────────────── Mode emblems ───────────────────────── */

const W = { stroke: '#fff', strokeWidth: 5.5, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };
const R = { ...W, stroke: RED };
const GLYPH = {
  // planted bomb: body, fuse bar, red timer
  retake: <><rect x="17" y="24" width="30" height="22" rx="5" {...W} /><path d="M26 16h12" {...W} /><path d="M27 35h10" {...R} /></>,
  // five against five
  '5v5': <><path d="M12 14h14M12 23h14M12 32h14M12 41h14M12 50h14" {...W} /><path d="M38 14h14M38 23h14M38 32h14M38 41h14M38 50h14" {...R} /></>,
  // free-for-all: open crosshair, red centre
  dm: <><path d="M32 10v12M32 42v12M10 32h12M42 32h12" {...W} /><circle cx="32" cy="32" r="4" fill={RED} /></>,
  // aim: two arcs closing on the dot
  aim: <><path d="M14 32a18 18 0 0 1 36 0" {...W} /><path d="M23 40a9 9 0 0 0 18 0" {...W} /><circle cx="32" cy="32" r="4" fill={RED} /></>,
  // rust: wall of planks, one torn out
  rust: <><path d="M12 18h40M12 46h40" {...W} /><path d="M12 32h14" {...W} /><path d="M38 32h14" {...R} /></>,
  // blocks
  mc: <><rect x="13" y="13" width="15" height="15" rx="3" {...W} /><rect x="36" y="13" width="15" height="15" rx="3" {...W} /><rect x="13" y="36" width="15" height="15" rx="3" {...W} /><rect x="36" y="36" width="15" height="15" rx="3" {...R} /></>,
};

/** Bold bar-built pictogram on a leaning plate. VIP servers get an amber plate edge. */
export function ModeEmblem({ mode, vip, className = 'size-12' }) {
  return (
    <svg viewBox="0 0 76 64" className={className} aria-hidden="true">
      <path d="M14 1h61L62 63H1z" fill="#fff" fillOpacity="0.06" stroke={vip ? WARN : '#fff'} strokeOpacity={vip ? 1 : 0.22} strokeWidth="1.5" />
      <g transform="translate(6 0)">{GLYPH[mode] ?? GLYPH.dm}</g>
    </svg>
  );
}

/* ───────────────────────── Bar meters ───────────────────────── */

/**
 * The quota gauge: one leaning bar per unit (15 GB plan → 15 bars). Lit bars are what is left;
 * they go amber under 30% and crimson under 10%, like shift lights.
 */
export function RevBar({ cells, left, className }) {
  const share = left / cells;
  const c = share <= 0.1 ? '#FF1E27' : share <= 0.3 ? WARN : '#fff';
  return (
    <div className={`flex -skew-x-[14deg] gap-[5px] ${className ?? ''}`} dir="ltr" aria-hidden="true">
      {Array.from({ length: cells }, (_, i) => (
        <span key={i} className="h-full flex-1 transition-colors duration-500" style={i < left ? { background: c } : { boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.22)' }} />
      ))}
    </div>
  );
}

/** Ten-bar load meter for CPU / RAM. */
export function ArcMeter({ value, label }) {
  const v = Math.max(0, Math.min(100, value));
  const c = v >= 85 ? '#FF1E27' : v >= 65 ? WARN : '#fff';
  return (
    <div>
      <div className="flex items-baseline justify-between" dir="ltr">
        <span className="mono text-xs text-zinc-500">{label}</span>
        <span className="mono text-lg font-black italic" style={{ color: c }}>{value}%</span>
      </div>
      <div className="mt-1.5 flex h-3 -skew-x-[14deg] gap-[3px]" dir="ltr" aria-hidden="true">
        {Array.from({ length: 10 }, (_, i) => <span key={i} className="flex-1 transition-colors duration-500" style={{ background: i < Math.round(v / 10) ? c : 'rgba(255,255,255,.12)' }} />)}
      </div>
    </div>
  );
}

/** Player seats: one leaning bar per seat (grouped when the server is large). */
export function Pips({ value, max, cells = 20 }) {
  const n = Math.min(cells, max);
  const lit = Math.round((value / max) * n);
  const c = value >= max ? '#FF1E27' : '#fff';
  return (
    <div className="flex h-3.5 -skew-x-[14deg] gap-[3px]" dir="ltr" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => <span key={i} className="flex-1 transition-colors duration-500" style={{ background: i < lit ? c : 'rgba(255,255,255,.13)' }} />)}
    </div>
  );
}

/** Signal strength as three rising bars. */
export function PingBars({ ping, className = 'h-4' }) {
  const lvl = ping <= 20 ? 3 : ping <= 60 ? 2 : 1;
  const c = lvl === 3 ? OK : lvl === 2 ? WARN : '#FF1E27';
  return (
    <svg viewBox="0 0 20 16" className={className} aria-hidden="true">
      {[0, 1, 2].map((i) => <path key={i} d={`M${3 + i * 7} 14V${10 - i * 4}`} stroke={i < lvl ? c : '#3F3F46'} strokeWidth="4" strokeLinecap="round" />)}
    </svg>
  );
}
