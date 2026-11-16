import { useEffect, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';
import { TitleMark } from './art.jsx';

export const cx = (...a) => a.filter(Boolean).join(' ');

const BTN = {
  primary: 'bg-brand text-white hover:bg-white hover:text-black',
  ghost: 'bg-white/[0.07] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.3)] hover:bg-white hover:text-black',
  outline: 'text-white shadow-[inset_0_0_0_1.5px_#e60012] hover:bg-brand',
  danger: 'text-red-300 shadow-[inset_0_0_0_1px_rgba(255,30,39,.6)] hover:bg-brand hover:text-white',
  ok: 'text-emerald-300 shadow-[inset_0_0_0_1px_rgba(16,185,129,.55)] hover:bg-emerald-500 hover:text-black',
};
const SIZE = { sm: 'h-8 px-3.5 text-xs', md: 'h-10 px-5 text-[13px]', lg: 'h-13 px-8 text-[15px]' };
const SQUARE = { sm: 'h-8 w-9', md: 'h-10 w-11', lg: 'h-13 w-14' };

/** Leaning plate button. The box is skewed to the logo's angle; the label stays upright. */
export function Btn({ variant = 'primary', size = 'md', icon: Icon, children, className, busy, ...p }) {
  return (
    <button
      type="button"
      {...p}
      disabled={p.disabled || busy}
      className={cx('para inline-flex shrink-0 items-center justify-center font-black whitespace-nowrap transition-colors duration-150 active:translate-x-0.5 disabled:opacity-35', BTN[variant], children == null ? SQUARE[size] : SIZE[size], className)}
    >
      <span className="inline-flex items-center gap-2">
        {busy ? <span className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current" /> : Icon && <Icon className="size-4" />}
        {children}
      </span>
    </button>
  );
}

/** Cut-glass slab. `red` is the crimson pane used once per screen for the thing that matters. */
export const Card = ({ className, red, as: As = 'div', ...p }) => (
  <As {...p} className={cx('relative', red ? 'glass-red' : 'glass', className)} />
);

const TONE = { ok: 'text-emerald-300', warn: 'text-amber-300', bad: 'text-red-400', mute: 'text-zinc-400', brand: 'text-white' };
const MARK = { ok: 'bg-ok', warn: 'bg-warn', bad: 'bg-brand2', mute: 'bg-zinc-600', brand: 'bg-brand' };
/** Status tag: a leaning colour chip and plain text, no outline box. */
export const Badge = ({ tone = 'mute', icon: Icon, children, className }) => (
  <span className={cx('inline-flex items-center gap-1.5 text-xs font-bold whitespace-nowrap', TONE[tone], className)}>
    {Icon ? <Icon className="size-3.5" /> : <span className={cx('h-2.5 w-1.5 -skew-x-[14deg]', MARK[tone])} />}
    {children}
  </span>
);

export const Mono = ({ className, children, ...p }) => (
  <span dir="ltr" {...p} className={cx('mono', className)}>{children}</span>
);

export const Dot = ({ tone = 'ok' }) => (
  <span className={cx('inline-block h-2.5 w-1.5 shrink-0 -skew-x-[14deg] animate-pulse', tone === 'ok' ? 'bg-ok' : tone === 'warn' ? 'bg-warn' : 'bg-brand2')} />
);

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

export function CopyBtn({ text, label, size = 'sm', variant = 'ghost', className }) {
  const [done, setDone] = useState(false);
  return (
    <Btn
      size={size}
      variant={variant}
      className={className}
      icon={done ? Check : Copy}
      aria-label={label ? undefined : 'کپی'}
      onClick={async () => {
        if (await copyText(text)) {
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        }
      }}
    >
      {label ? (done ? 'کپی شد' : label) : null}
    </Btn>
  );
}

export function Progress({ value, tone, className, h = 'h-1' }) {
  const v = Math.max(0, Math.min(100, value));
  const color = tone ?? (v >= 90 ? 'bg-brand2' : v >= 70 ? 'bg-warn' : 'bg-white');
  return (
    <div className={cx('w-full bg-white/[0.12]', h, className)} dir="ltr">
      <div className={cx('h-full transition-[width] duration-700', color)} style={{ width: `${v}%` }} />
    </div>
  );
}

function useEscape(open, onClose) {
  useEffect(() => {
    if (!open) return;
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
}

const Head = ({ title, icon: Icon, onClose }) => (
  <div className="flex items-center gap-3 px-6 pt-6 pb-4 sm:px-8">
    {Icon && <Icon className="size-5 shrink-0 text-brand2" />}
    <h3 className="min-w-0 flex-1 truncate text-xl font-black">{title}</h3>
    <button type="button" onClick={onClose} aria-label="بستن" className="grid size-9 place-items-center text-zinc-400 transition hover:bg-white hover:text-black">
      <X className="size-5" />
    </button>
  </div>
);

export function Modal({ open, onClose, title, icon, children, wide, footer }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="gutter fixed inset-0 z-50 flex items-center justify-center py-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/75" onClick={onClose} />
      <div className={cx('glass animate-rise relative flex max-h-full w-full flex-col', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <Head title={title} icon={icon} onClose={onClose} />
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 sm:px-8">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-3 px-6 pb-7 sm:px-8">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, icon, children }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/75" onClick={onClose} />
      <div className="glass animate-rise absolute inset-y-0 left-0 flex w-full max-w-2xl flex-col">
        <Head title={title} icon={icon} onClose={onClose} />
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 sm:px-8">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, hint, error, children, className }) {
  return (
    <label className={cx('flex min-w-0 flex-col gap-1.5', className)}>
      <span className="text-xs font-bold text-zinc-400">{label}</span>
      {children}
      {error ? <span className="text-xs text-red-400">{error}</span> : hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

/** Leaning switch: the slider is a bar, like everything else. */
export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} dir="ltr"
      className={cx('relative h-6 w-12 shrink-0 -skew-x-[14deg] transition-colors duration-200', checked ? 'bg-ok' : 'bg-white/15')}
    >
      <span className={cx('absolute inset-y-1 w-4 transition-all duration-200', checked ? 'left-7 bg-black' : 'left-1 bg-white')} />
    </button>
  );
}

const tabCls = (on) => cx('para shrink-0 px-4 py-2 text-[13px] font-bold whitespace-nowrap transition-colors duration-150', on ? 'bg-white text-black' : 'text-zinc-400 hover:text-white');

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={cx('flex gap-1 overflow-x-auto px-1', className)} role="tablist">
      {tabs.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)} className={tabCls(value === t.id)}>
          <span className="inline-flex items-center gap-2">{t.icon && <t.icon className="size-4" />}{t.label}</span>
        </button>
      ))}
    </div>
  );
}

/** Section index down the side on desktop, a strip of leaning tabs on phones. No box around it. */
export function RailLayout({ tabs, value, onChange, children, foot }) {
  return (
    <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[210px_minmax(0,1fr)] lg:gap-12">
      <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <nav className="flex gap-1 overflow-x-auto px-1 lg:flex-col lg:gap-0 lg:px-0" role="tablist">
          {tabs.map((t) => {
            const on = value === t.id;
            return (
              <button
                key={t.id} type="button" role="tab" aria-selected={on} onClick={() => onChange(t.id)}
                className={cx(
                  'group flex shrink-0 items-center gap-3 px-4 py-2 text-[13px] font-bold whitespace-nowrap transition-colors duration-150 max-lg:[transform:skewX(var(--lean))] lg:border-s-2 lg:py-3 lg:text-[15px]',
                  on ? 'text-white max-lg:bg-white max-lg:text-black lg:border-brand' : 'text-zinc-500 hover:text-white lg:border-white/10',
                )}
              >
                <span className="flex flex-1 items-center gap-3 text-start max-lg:[transform:skewX(calc(var(--lean)*-1))]">
                  <t.icon className={cx('size-4', on && 'lg:text-brand2')} />
                  <span className="flex-1">{t.label}</span>
                  {t.count != null && <span className="mono text-xs italic opacity-50">{t.count}</span>}
                </span>
              </button>
            );
          })}
        </nav>
        {foot && <div className="mt-8 hidden lg:block">{foot}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export const SectionTitle = ({ title, desc, action }) => (
  <div className="flex flex-wrap items-end justify-between gap-6">
    <div className="min-w-0">
      <h2 className="flex items-center gap-4 text-4xl leading-tight font-black sm:text-6xl"><TitleMark />{title}</h2>
      {desc && <p className="mt-4 max-w-xl text-[15px] text-zinc-400">{desc}</p>}
    </div>
    {action}
  </div>
);

/** A figure on a rule: label, then a heavy italic number. Not a card. */
export const Stat = ({ label, value, sub, tone = 'text-white' }) => (
  <div className="min-w-0 border-t-2 border-white/15 pt-3">
    <div className="truncate text-xs font-bold text-zinc-400">{label}</div>
    <div className={cx('mt-1 truncate text-4xl font-black italic sm:text-5xl', tone)}>{value}</div>
    {sub && <div className="truncate text-xs text-zinc-500">{sub}</div>}
  </div>
);
