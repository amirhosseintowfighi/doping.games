// Interactive route scene for the hero: you → Doping's Tehran edge → an exit node → the game's servers,
// next to the long ordinary-internet route. Exits are clickable, games are picked from their covers,
// and a switch compares the two routes. Shares the game / exit / ISP choice with the ping test below.
import { useLayoutEffect, useRef, useState } from 'react';
import { Gamepad2 } from 'lucide-react';
import DopingLogo from '../Logo.jsx';
import { coverThumb } from '../covers.js';
import { EXITS, fa, ISPS, trackedGames } from '../data.js';
import { useMotion, useTilt } from '../motion.jsx';
import { useStore } from '../store.jsx';
import { cx } from '../ui.jsx';

const W = 600;
const H = 420;
const YOU = [548, 200];
const EDGE = [436, 200];
const DC = [86, 200];
const EXIT_AT = { dxb: [298, 84], mct: [298, 200], fra: [298, 316] };
const OK = '#10b981';
const ISP_LINE = '#71717a';
const mono = { fontFamily: 'var(--font-mono)' };
const sans = { fontFamily: 'var(--font-sans)' };

/** The tunnel as one path: you → edge → exit → just short of the game server tile. */
function tunnel(exit) {
  const [x, y] = EXIT_AT[exit];
  return `M${YOU[0] - 24} ${YOU[1]}L${EDGE[0] + 26} ${EDGE[1]}L${EDGE[0]} ${EDGE[1]}`
    + `C${EDGE[0] - 64} ${EDGE[1]} ${x + 62} ${y} ${x} ${y}`
    + `C${x - 72} ${y} ${DC[0] + 96} ${DC[1]} ${DC[0] + 30} ${DC[1]}`;
}
const branch = (exit) => tunnel(exit).replace(/^M[^C]+/, `M${EDGE[0]} ${EDGE[1]}`);
// The ordinary route wanders under the scene through many hops before it reaches the server.
const ISP_PATH = `M${YOU[0]} ${YOU[1] + 24}C${YOU[0]} 300 486 372 410 366S300 398 246 364S150 384 118 330S${DC[0]} 272 ${DC[0]} ${DC[1] + 44}`;
const HOPS = 9;

export default function HeroScene() {
  const { s, set } = useStore();
  const motion = useMotion();
  const tilt = useTilt(5);
  const [doping, setDoping] = useState(true);
  const [hover, setHover] = useState(null);
  const ispRef = useRef(null);
  const [hops, setHops] = useState([]);
  // Text in the scene scales with the viewBox; on narrow screens it is enlarged so it stays readable.
  const box = useRef(null);
  const [k, setK] = useState(1);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return undefined;
    const fit = () => { const w = el.clientWidth; setK(w < 440 ? 1.55 : w < 560 ? 1.3 : 1); };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const GAMES = trackedGames(s.site);
  const game = GAMES.find((g) => g.id === s.prefs.game) ?? GAMES[0];
  const isp = ISPS.find((i) => i.id === s.prefs.isp) ?? ISPS[0];
  const exit = s.exit;
  const ping = (e) => game.via[e][0];
  const best = Object.keys(EXIT_AT).sort((a, b) => ping(a) - ping(b))[0];
  const ispPing = Math.round(game.isp[0] * isp.k);
  const ispLoss = Math.max(0, game.isp[1] + isp.loss);
  const [ex, ey] = EXIT_AT[exit];
  const pick = (e) => set({ exit: e });

  // Hop markers sit on the ordinary route itself, measured from the drawn path.
  useLayoutEffect(() => {
    const p = ispRef.current;
    if (!p?.getTotalLength) return;
    const len = p.getTotalLength();
    setHops(Array.from({ length: HOPS }, (_, i) => p.getPointAtLength((len * (i + 1)) / (HOPS + 1))).map((pt) => [pt.x, pt.y]));
  }, []);

  return (
    <div className="relative min-w-0">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-line bg-card p-1 text-[13px]" role="tablist" aria-label="مقایسه مسیر">
          {[[true, 'با دوپینگ'], [false, 'بدون دوپینگ']].map(([v, label]) => (
            <button key={label} type="button" role="tab" aria-selected={doping === v} onClick={() => setDoping(v)} className={cx('rounded-lg px-3 py-1.5 transition-colors', doping === v ? (v ? 'bg-ok/15 font-bold text-ok' : 'bg-white/10 font-bold text-white') : 'text-zinc-400 hover:text-white')}>
              {label}
            </button>
          ))}
        </div>
        <div className="text-end text-xs leading-5" aria-live="polite">
          <div className={cx('font-bold', doping ? 'text-ok' : 'text-zinc-300')}>
            <span className="mono text-lg" dir="ltr">{doping ? ping(exit) : ispPing}</span><span className="mono ms-1 text-zinc-500" dir="ltr">ms</span>
          </div>
          <div className="text-zinc-500">{doping ? `از خروجی ${EXITS.find((e) => e.id === exit).name}` : `${fa(ispLoss)}٪ پکت لاس`}</div>
        </div>
      </div>

      <div ref={(el) => { tilt.current = el; box.current = el; }} className="tilt no-glare relative">
        {/* depth layer: dot field and radar rings around the Tehran edge */}
        <svg data-depth="-0.35" viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 size-full" aria-hidden="true">
          <defs>
            <pattern id="hero-dots" width="18" height="18" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1.2" fill="#fff" fillOpacity="0.07" /></pattern>
            <radialGradient id="hero-fade" cx="60%" cy="48%" r="60%"><stop offset="0" stopColor="#fff" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></radialGradient>
            <mask id="hero-mask"><rect width={W} height={H} fill="url(#hero-fade)" /></mask>
          </defs>
          <rect width={W} height={H} fill="url(#hero-dots)" mask="url(#hero-mask)" />
          {[60, 120, 190, 270].map((r) => <circle key={r} cx={EDGE[0]} cy={EDGE[1]} r={r} fill="none" stroke="#fff" strokeOpacity="0.05" strokeDasharray="2 6" />)}
        </svg>

        <svg data-depth="0.12" viewBox={`0 0 ${W} ${H}`} className="relative block w-full" role="group" aria-label="مسیر اتصال از شما تا سرور بازی" style={{ direction: 'ltr' }}>
          <defs>
            <clipPath id="hero-cover"><rect x={DC[0] - 30} y={DC[1] - 45} width="60" height="90" rx="10" /></clipPath>
            <filter id="hero-glow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="4" /></filter>
          </defs>

          {/* ordinary internet: long, many hops, some packets never arrive */}
          <g opacity={doping ? 0.45 : 1} style={{ transition: 'opacity .4s' }}>
            <path ref={ispRef} d={ISP_PATH} fill="none" stroke={ISP_LINE} strokeWidth="1.6" strokeDasharray="4 6" />
            {hops.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.5" fill="#08080a" stroke={ISP_LINE} strokeWidth="1.5" />)}
            {hops[5] && ispLoss > 0 && (
              <g transform={`translate(${hops[5][0]} ${hops[5][1]})`} stroke="#ff1e27" strokeWidth="2" strokeLinecap="round">
                <path d="M-5 -5L5 5M5 -5L-5 5">{motion && <animate attributeName="opacity" values="0;0;1;0" keyTimes="0;0.5;0.56;1" dur="3.6s" repeatCount="indefinite" />}</path>
              </g>
            )}
            {motion && !doping && [0, 1.2, 2.4].map((b, i) => (
              <circle key={i} r="4" fill="#d4d4d8">
                <animateMotion dur="3.6s" begin={`${b}s`} repeatCount="indefinite" path={ISP_PATH} />
                {i === 1 && ispLoss > 0 && <animate attributeName="opacity" values="1;1;0;0" keyTimes="0;0.52;0.56;1" dur="3.6s" begin={`${b}s`} repeatCount="indefinite" />}
              </circle>
            ))}
            <g transform={`translate(330 ${408 - 6 * k})`}>
              <rect x={-86 * k} y={-14 * k} width={172 * k} height={28 * k} rx={14 * k} fill="#101014" stroke="#2a2a33" />
              <text textAnchor="middle" y={5 * k} fontSize={13 * k} fill="#f59e0b" style={mono}>{ispPing}ms · {ispLoss}% loss</text>
            </g>
          </g>

          {/* idle exit branches, then the hovered preview, then the live tunnel */}
          {Object.keys(EXIT_AT).filter((e) => e !== exit).map((e) => (
            <path key={e} d={branch(e)} fill="none" stroke="#fff" strokeOpacity={hover === e ? 0.55 : 0.12} strokeWidth="1.5" strokeDasharray={hover === e ? '5 5' : undefined} style={{ transition: 'stroke-opacity .2s' }} />
          ))}
          <g opacity={doping ? 1 : 0.3} style={{ transition: 'opacity .4s' }}>
            <path d={tunnel(exit)} fill="none" stroke={OK} strokeOpacity="0.35" strokeWidth="8" filter="url(#hero-glow)" />
            <path d={tunnel(exit)} fill="none" stroke={OK} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            {motion && doping && [0, 0.45, 0.9].map((b) => (
              <circle key={`${exit}-${b}`} r="4.5" fill="#fff">
                <animateMotion dur="1.35s" begin={`${b}s`} repeatCount="indefinite" path={tunnel(exit)} />
              </circle>
            ))}
            {/* the ping sits on the wire, between the exit and the game server */}
            <g transform={`translate(178 ${ey + (DC[1] - ey) * 0.8})`}>
              <rect x={-34 * k} y={-14 * k} width={68 * k} height={28 * k} rx={14 * k} fill="#08080a" stroke={OK} strokeOpacity="0.6" />
              <text textAnchor="middle" y={5 * k} fontSize={14 * k} fontWeight="700" fill={OK} style={mono}>{ping(exit)}ms</text>
            </g>
          </g>

          {/* you */}
          <g>
            <circle cx={YOU[0]} cy={YOU[1]} r="24" fill="#101014" stroke="#3f3f46" strokeWidth="1.5" />
            <Gamepad2 x={YOU[0] - 12} y={YOU[1] - 12} width="24" height="24" color="#fff" strokeWidth={1.75} />
            <text x={YOU[0]} y={YOU[1] + 28 + 18 * k} textAnchor="middle" fontSize={15 * k} fontWeight="700" fill="#fff" style={sans}>شما</text>
            <text x={YOU[0]} y={YOU[1] + 30 + 34 * k} textAnchor="middle" fontSize={12 * k} fill="#71717a" style={sans}>{isp.name}</text>
          </g>

          {/* Doping's Tehran edge */}
          <g>
            <rect x={EDGE[0] - 26} y={EDGE[1] - 26} width="52" height="52" rx="14" fill="#101014" stroke="#e60012" strokeOpacity="0.7" strokeWidth="1.5" />
            <DopingLogo variant="mark" title="" className="" x={EDGE[0] - 19} y={EDGE[1] - 13} width="38" height="26" />
            <text x={EDGE[0]} y={EDGE[1] + 28 + 18 * k} textAnchor="middle" fontSize={15 * k} fontWeight="700" fill="#fff" style={sans}>نود تهران</text>
            <text x={EDGE[0]} y={EDGE[1] + 30 + 34 * k} textAnchor="middle" fontSize={12 * k} fill="#71717a" style={mono}>MikroTik</text>
          </g>

          {/* exits: click or Enter to route through one */}
          {Object.entries(EXIT_AT).map(([e, [x, y]]) => {
            const on = e === exit;
            const name = EXITS.find((v) => v.id === e).name;
            return (
              <g
                key={e} role="button" tabIndex={0} aria-pressed={on} aria-label={`${name}${e === best ? ' ★' : ''} ${ping(e)}ms · خروجی`}
                onClick={() => pick(e)} onKeyDown={(k) => (k.key === 'Enter' || k.key === ' ') && (k.preventDefault(), pick(e))}
                onMouseEnter={() => setHover(e)} onMouseLeave={() => setHover(null)} onFocus={() => setHover(e)} onBlur={() => setHover(null)}
                className="cursor-pointer outline-none [&:focus-visible>circle:first-child]:stroke-white"
              >
                <circle cx={x} cy={y} r="26" fill="transparent" stroke={hover === e && !on ? '#52525b' : 'transparent'} strokeDasharray="3 4" />
                <circle cx={x} cy={y} r={on ? 11 : 8} fill={on ? '#fff' : '#08080a'} stroke={on ? '#fff' : '#71717a'} strokeWidth="2" style={{ transition: 'r .2s' }} />
                {on && <circle cx={x} cy={y} r="4" fill={OK} />}
                <text x={x} y={y - 12 - 10 * k} textAnchor="middle" fontSize={15 * k} fontWeight={on ? 800 : 500} fill={on ? '#fff' : '#a1a1aa'} style={sans}>{name}{e === best ? ' ★' : ''}</text>
                <text x={x} y={y + 16 + 14 * k} textAnchor="middle" fontSize={12 * k} fill={on ? OK : '#71717a'} style={mono}>{ping(e)}ms</text>
              </g>
            );
          })}

          {/* the game's servers, shown as its cover */}
          <g>
            <rect x={DC[0] - 32} y={DC[1] - 47} width="64" height="94" rx="12" fill="#101014" stroke="#3f3f46" strokeWidth="1.5" />
            <image href={coverThumb(game.cover)} x={DC[0] - 30} y={DC[1] - 45} width="60" height="90" preserveAspectRatio="xMidYMid slice" clipPath="url(#hero-cover)" />
            <text x={DC[0]} y={DC[1] - 49 - 23 * k} textAnchor="middle" fontSize={14 * k} fontWeight="700" fill="#fff" style={mono}>{game.name}</text>
            <text x={DC[0]} y={DC[1] - 49 - 7 * k} textAnchor="middle" fontSize={11 * k} fill="#71717a" style={mono}>{game.dc}</text>
          </g>
        </svg>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5" role="radiogroup" aria-label="بازی مقصد">
          {GAMES.map((g) => (
            <button
              key={g.id} type="button" role="radio" aria-checked={g.id === game.id} aria-label={`مقصد ${g.full}`} title={g.full}
              onClick={() => set((p) => ({ prefs: { ...p.prefs, game: g.id } }))}
              className={cx('h-12 w-8 overflow-hidden rounded-md border-2 transition', g.id === game.id ? 'border-white' : 'border-transparent opacity-45 hover:opacity-90')}
            >
              <img src={coverThumb(g.cover)} alt="" className="size-full object-cover" />
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-500">{s.site.hero.sceneHint}</p>
      </div>
    </div>
  );
}
