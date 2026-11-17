import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Copy, X } from 'lucide-react';

export const cx = (...a) => a.filter(Boolean).join(' ');

const BTN = {
  primary: 'bg-brand text-white hover:bg-brand2',
  ghost: 'bg-white/[0.06] text-zinc-100 hover:bg-white/[0.11]',
  outline: 'border border-edge text-zinc-100 hover:bg-white/[0.06]',
  danger: 'bg-red-500/10 text-red-300 hover:bg-red-500/20',
  ok: 'bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20',
};
const SIZE = { sm: 'h-8 px-3 text-xs gap-1.5 rounded-lg', md: 'h-10 px-4 text-[13px] gap-2 rounded-xl', lg: 'h-12 px-6 text-sm gap-2 rounded-xl' };
const SQUARE = { sm: 'size-8 rounded-lg', md: 'size-10 rounded-xl', lg: 'size-12 rounded-xl' };

export function Btn({ variant = 'primary', size = 'md', icon: Icon, children, className, busy, ...p }) {
  return (
    <button
      type="button"
      {...p}
      disabled={p.disabled || busy}
      className={cx('inline-flex shrink-0 items-center justify-center font-bold whitespace-nowrap transition-colors duration-150 disabled:opacity-40', BTN[variant], children == null ? SQUARE[size] : SIZE[size], className)}
    >
      {busy ? <span className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current" /> : Icon && <Icon className="size-4" />}
      {children}
    </button>
  );
}

export const Card = ({ className, red: _red, as: As = 'div', ...p }) => <As {...p} className={cx('glass relative', className)} />;

const TONE = {
  ok: 'bg-emerald-500/10 text-emerald-300', warn: 'bg-amber-500/10 text-amber-300', bad: 'bg-red-500/10 text-red-300',
  mute: 'bg-white/[0.06] text-zinc-400', brand: 'bg-white/[0.08] text-white',
};
export const Badge = ({ tone = 'mute', icon: Icon, children, className }) => (
  <span className={cx('inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-bold whitespace-nowrap', TONE[tone], className)}>
    {Icon && <Icon className="size-3" />}
    {children}
  </span>
);

export const Mono = ({ className, children, ...p }) => (
  <span dir="ltr" {...p} className={cx('mono', className)}>{children}</span>
);

export const Dot = ({ tone = 'ok' }) => (
  <span className={cx('inline-block size-1.5 shrink-0 animate-pulse rounded-full', tone === 'ok' ? 'bg-ok' : tone === 'warn' ? 'bg-warn' : 'bg-brand2')} />
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
    <div className={cx('w-full overflow-hidden rounded-full bg-line', h, className)} dir="ltr">
      <div className={cx('h-full rounded-full transition-[width] duration-700', color)} style={{ width: `${v}%` }} />
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

const Head = ({ title, onClose }) => (
  <div className="flex items-center gap-3 border-b border-line px-6 py-4">
    <h3 className="min-w-0 flex-1 truncate text-base font-black">{title}</h3>
    <button type="button" onClick={onClose} aria-label="بستن" className="grid size-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/10 hover:text-white">
      <X className="size-4" />
    </button>
  </div>
);

export function Modal({ open, onClose, title, children, wide, footer }) {
  useEscape(open, onClose);
  if (!open) return null;
  // Portalled to <body>: an animated ancestor would otherwise become the containing block and the dialog
  // would be centred on the whole page instead of the viewport.
  return createPortal(
    <div className="gutter fixed inset-0 z-50 flex items-center justify-center py-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className={cx('glass animate-rise relative flex max-h-full w-full flex-col', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <Head title={title} onClose={onClose} />
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ open, onClose, title, children }) {
  useEscape(open, onClose);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="animate-rise absolute inset-y-0 left-0 flex w-full max-w-2xl flex-col border-r border-line bg-card">
        <Head title={title} onClose={onClose} />
        <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function Field({ label, hint, error, children, className }) {
  return (
    <label className={cx('flex min-w-0 flex-col gap-1.5', className)}>
      <span className="text-xs text-zinc-400">{label}</span>
      {children}
      {error ? <span className="text-xs text-red-400">{error}</span> : hint && <span className="text-xs text-zinc-600">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} dir="ltr"
      className={cx('relative h-6 w-10 shrink-0 rounded-full transition-colors duration-200', checked ? 'bg-ok' : 'bg-edge')}
    >
      <span className={cx('absolute top-1 size-4 rounded-full bg-white transition-all duration-200', checked ? 'left-5' : 'left-1')} />
    </button>
  );
}

/** Segmented control. */
export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={cx('inline-flex max-w-full gap-1 overflow-x-auto rounded-xl border border-line bg-card p-1', className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id} type="button" role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={cx('inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-1.5 text-[13px] whitespace-nowrap transition-colors', value === t.id ? 'bg-white/10 font-bold text-white' : 'text-zinc-400 hover:text-white')}
        >
          {t.label}
          {t.note && <span className="text-[11px] text-ok">{t.note}</span>}
        </button>
      ))}
    </div>
  );
}

/** Sidebar list on desktop, scrollable strip on phones. */
export function RailLayout({ tabs, value, onChange, children, foot }) {
  return (
    <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-10">
      <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
        <nav className="flex gap-1 overflow-x-auto lg:flex-col" role="tablist">
          {tabs.map((t) => {
            const on = value === t.id;
            return (
              <button
                key={t.id} type="button" role="tab" aria-selected={on} onClick={() => onChange(t.id)}
                className={cx('flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-[13px] whitespace-nowrap transition-colors', on ? 'bg-white/[0.07] font-bold text-white' : 'text-zinc-400 hover:text-white')}
              >
                <t.icon className="size-4" />
                <span className="flex-1 text-start">{t.label}</span>
                {t.count != null && <span className="mono text-[11px] text-zinc-600">{t.count}</span>}
              </button>
            );
          })}
        </nav>
        {foot && <div className="mt-6 hidden lg:block">{foot}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export const SectionTitle = ({ label, title, desc, action }) => (
  <div className="flex flex-wrap items-end justify-between gap-6">
    <div className="min-w-0">
      {label && <div className="mb-3 flex items-center gap-2 text-xs text-zinc-500"><span className="h-px w-5 bg-zinc-600" />{label}</div>}
      <h2 className="text-2xl leading-snug font-black sm:text-[2rem]">{title}</h2>
      {desc && <p className="mt-3 max-w-xl text-sm text-zinc-400">{desc}</p>}
    </div>
    {action}
  </div>
);

export const Stat = ({ label, value, sub, tone = 'text-white' }) => (
  <div className="min-w-0 bg-ink px-5 py-4">
    <div className={cx('truncate text-2xl font-black', tone)}>{value}</div>
    <div className="mt-0.5 truncate text-xs text-zinc-500">{label}{sub && ` · ${sub}`}</div>
  </div>
);
