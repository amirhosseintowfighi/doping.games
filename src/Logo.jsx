import { useId } from 'react';

const RED = '#E60012';

/** The red "D": forward-leaning body, slanted counter and 4 rounded speed-trail bars on its left. */
function Mark({ maskId }) {
  return (
    <>
      <defs>
        <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="640" height="410">
          <rect width="640" height="410" fill="#fff" />
          <path d="M403 100H525L439 310H317Z" fill="#000" />
        </mask>
      </defs>
      <g mask={`url(#${maskId})`} stroke={RED} fill={RED} strokeLinecap="round" strokeLinejoin="round">
        <path d="M356 68H566L454 342H244Z" strokeWidth="56" />
        <path d="M218 68H356" strokeWidth="56" fill="none" />
        <path d="M262 128H330M107 193H300" strokeWidth="44" fill="none" />
        <path d="M35 255H80M130 255H145M195 255H270" strokeWidth="40" fill="none" />
      </g>
    </>
  );
}

/** Upright glyphs on a 100-unit cap height; the group is skewed to match the D. */
const GLYPHS = [
  { w: 112, d: 'M16 0H112V100H0V16ZM27 27V73H85V27Z' }, // O
  { w: 112, d: 'M0 0H112V66H27V100H0ZM27 27V40H85V27Z' }, // P
  { w: 27, d: 'M0 0H27V100H0Z' }, // I
  { w: 112, d: 'M0 100V0H31L85 66V0H112V122L27 40V100Z' }, // N with the spike under the baseline
  { w: 112, d: 'M16 0H112V27H27V73H85V62H54V40H112V100H0V16Z' }, // G
];

/**
 * <DopingLogo /> full lockup · <DopingLogo variant="mark" /> the D alone.
 * Size it with a height class (e.g. className="h-8"); width follows the viewBox.
 */
export default function DopingLogo({ variant = 'full', className = 'h-8', title = 'Doping', ...rest }) {
  const id = useId();
  if (variant === 'mark') {
    return (
      <svg viewBox="0 0 640 410" className={className} role={title ? 'img' : undefined} aria-label={title || undefined} aria-hidden={title ? undefined : true} style={{ direction: 'ltr' }} {...rest}>
        <Mark maskId={`${id}m`} />
      </svg>
    );
  }
  let x = 0;
  return (
    <svg viewBox="0 0 1330 410" className={className} role="img" aria-label={title} style={{ direction: 'ltr' }}>
      <Mark maskId={`${id}m`} />
      <defs>
        <mask id={`${id}s`} maskUnits="userSpaceOnUse" x="480" y="200" width="860" height="210">
          <rect x="480" y="200" width="860" height="210" fill="#fff" />
          {/* the sharp horizontal slice through the upper stems */}
          <rect x="480" y="266" width="860" height="7" fill="#000" />
        </mask>
      </defs>
      <g mask={`url(#${id}s)`}>
        <g transform="translate(497 370) skewX(-22.2) scale(1.5) translate(0 -100)" fill="#fff" fillRule="evenodd">
          {GLYPHS.map((g, i) => {
            const el = <path key={i} d={g.d} transform={`translate(${x} 0)`} />;
            x += g.w + 15;
            return el;
          })}
        </g>
      </g>
    </svg>
  );
}
