// Motion layer: scroll / pointer parallax, 3D tilt, cursor spotlight, count-up numbers,
// scroll progress and back-to-top. One shared scroll + pointer listener drives everything,
// and every effect writes styles directly to the DOM so React does not re-render per frame.
// All of it switches off for `prefers-reduced-motion` and when the admin turns motion off.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { useStore } from './store.jsx';
import { cx } from './ui.jsx';

const reducedMotion = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const finePointer = () => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: fine)').matches;

/** True when motion is allowed: the admin setting is on and the visitor has not asked for less motion. */
export function useMotion() {
  const { s } = useStore();
  return s.site.motion !== false && !reducedMotion();
}

/* ───────── shared frame loop ───────── */

const tasks = new Set();
const pointer = { x: 0, y: 0 };
let raf = 0;
let installed = false;
const run = () => { raf = 0; tasks.forEach((t) => t()); };
const schedule = () => { if (!raf) raf = requestAnimationFrame(run); };
function install() {
  if (installed) return;
  installed = true;
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse') return;
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
    schedule();
  }, { passive: true });
}
function useFrame(fn, enabled) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (!enabled) return undefined;
    install();
    const t = () => ref.current();
    tasks.add(t);
    schedule();
    return () => { tasks.delete(t); };
  }, [enabled]);
}

/* ───────── parallax ───────── */

/**
 * Moves every `[data-depth]` descendant of `ref` as the scene scrolls through the viewport.
 * `data-depth` is a multiplier (negative moves the other way); `data-axis="x"` slides sideways.
 * With a mouse, layers also drift towards the pointer by `mouse` px × depth.
 */
export function useParallax(ref, { range = 120, mouse = 16 } = {}) {
  const on = useMotion();
  useFrame(() => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vh = window.innerHeight;
    if (r.bottom < -vh * 0.5 || r.top > vh * 1.5) return;
    // −1 when the scene's centre sits at the bottom of the viewport, +1 when it reaches the top.
    const p = Math.max(-1.2, Math.min(1.2, (vh / 2 - (r.top + r.height / 2)) / (vh / 2 + r.height / 2)));
    const mx = finePointer() ? pointer.x : 0;
    const my = finePointer() ? pointer.y : 0;
    el.querySelectorAll('[data-depth]').forEach((layer) => {
      const d = parseFloat(layer.dataset.depth) || 0;
      const sideways = layer.dataset.axis === 'x';
      const tx = (sideways ? p * range * d : 0) + mx * mouse * d;
      const ty = (sideways ? 0 : p * range * d) + my * mouse * d;
      layer.style.transform = `translate3d(${tx.toFixed(1)}px, ${ty.toFixed(1)}px, 0)`;
    });
  }, on);
  // Clear transforms when motion is switched off.
  useEffect(() => {
    if (on) return;
    ref.current?.querySelectorAll('[data-depth]').forEach((l) => { l.style.transform = ''; });
  }, [on, ref]);
}

/* ───────── scroll progress & back to top ───────── */

export function ScrollProgress() {
  const bar = useRef(null);
  useFrame(() => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    if (bar.current) bar.current.style.transform = `scaleX(${max > 0 ? Math.min(1, window.scrollY / max) : 0})`;
  }, true);
  return <div ref={bar} className="pointer-events-none absolute inset-x-0 bottom-0 h-px origin-right scale-x-0 bg-brand" aria-hidden="true" />;
}

export function BackToTop() {
  const [show, setShow] = useState(false);
  useFrame(() => {
    const next = window.scrollY > 900;
    setShow((v) => (v === next ? v : next));
  }, true);
  return (
    <button
      type="button"
      aria-label="برگشت به بالای صفحه"
      onClick={() => window.scrollTo({ top: 0, behavior: reducedMotion() ? 'auto' : 'smooth' })}
      className={cx(
        'fixed z-30 grid size-11 place-items-center rounded-full border border-edge bg-raise text-zinc-200 shadow-xl shadow-black transition duration-300 hover:bg-white hover:text-black',
        show ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-4 opacity-0',
      )}
      style={{ left: 'max(1rem, env(safe-area-inset-left, 0px))', bottom: 'max(1.25rem, env(safe-area-inset-bottom, 0px))' }}
      tabIndex={show ? 0 : -1}
    >
      <ArrowUp className="size-5" />
    </button>
  );
}

/* ───────── tilt & spotlight ───────── */

/** 3D tilt towards the pointer, with a soft glare. Returns a ref for the element (which needs class `tilt`). */
export function useTilt(max = 9) {
  const ref = useRef(null);
  const on = useMotion();
  useEffect(() => {
    const el = ref.current;
    if (!el || !on || !finePointer()) return undefined;
    const move = (e) => {
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      el.style.setProperty('--rx', `${((0.5 - py) * max).toFixed(2)}deg`);
      el.style.setProperty('--ry', `${((px - 0.5) * max).toFixed(2)}deg`);
      el.style.setProperty('--gx', `${(px * 100).toFixed(1)}%`);
      el.style.setProperty('--gy', `${(py * 100).toFixed(1)}%`);
      el.dataset.tilt = 'on';
    };
    const leave = () => {
      el.style.setProperty('--rx', '0deg');
      el.style.setProperty('--ry', '0deg');
      delete el.dataset.tilt;
    };
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerleave', leave);
    return () => { el.removeEventListener('pointermove', move); el.removeEventListener('pointerleave', leave); leave(); };
  }, [on, max]);
  return ref;
}

/** One listener for every `.spot` element: a soft light follows the cursor across the card. */
export function useSpotlight() {
  useEffect(() => {
    const move = (e) => {
      const el = e.target instanceof Element ? e.target.closest('.spot') : null;
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    document.addEventListener('pointermove', move, { passive: true });
    return () => document.removeEventListener('pointermove', move);
  }, []);
}

/* ───────── count-up ───────── */

/**
 * Animates a number to `value`. On first appearance it counts up from zero; afterwards it eases
 * from the previous value, so live numbers (players online, prices) glide instead of jumping.
 */
export function CountUp({ value, format = (n) => String(Math.round(n)), decimals = 0, duration = 900, className }) {
  const on = useMotion();
  const el = useRef(null);
  const shown = useRef(value);
  const seen = useRef(false);
  const [text, setText] = useState(() => format(value));

  const animate = (from, to) => {
    const start = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - start) / duration);
      const v = from + (to - from) * (1 - (1 - k) ** 3);
      shown.current = v;
      setText(format(decimals ? Number(v.toFixed(decimals)) : Math.round(v)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };

  // First appearance: count from zero when the number scrolls into view.
  useLayoutEffect(() => {
    if (!on || seen.current || !el.current) return undefined;
    // Already on screen at mount: start from zero before the first paint, so it never flashes the final value.
    const r = el.current.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) {
      seen.current = true;
      setText(format(0));
      animate(0, value);
      return undefined;
    }
    const io = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      seen.current = true;
      io.disconnect();
      animate(0, value);
    }, { threshold: 0.4 });
    io.observe(el.current);
    return () => io.disconnect();
  }, [on]); // eslint-disable-line react-hooks/exhaustive-deps

  // Later changes: glide from the current value.
  useEffect(() => {
    if (!on || !seen.current) { shown.current = value; setText(format(value)); return; }
    if (shown.current !== value) animate(shown.current, value);
  }, [value, on]); // eslint-disable-line react-hooks/exhaustive-deps

  return <span ref={el} className={className}>{text}</span>;
}
