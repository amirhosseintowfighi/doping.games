import { useEffect, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';

export const cx = (...a) => a.filter(Boolean).join(' ');

const BTN = {
  primary: 'bg-brand-grad text-white shadow-lg shadow-red-600/25 hover:shadow-red-600/45 hover:brightness-110',
  ghost: 'bg-white/5 text-white hover:bg-white/10 border border-white/10',
  outline: 'border border-brand/50 text-white hover:bg-brand/15',
  danger: 'bg-red-950/60 text-red-200 border border-red-500/30 hover:bg-red-900/60',
  ok: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25',
};
const SIZE = { sm: 'h-8 px-3 text-xs gap-1.5', md: 'h-10 px-4 text-sm gap-2', lg: 'h-12 px-6 text-base gap-2.5' };

export function Btn({ variant = 'primary', size = 'md', icon: Icon, children, className, busy, ...p }) {
  return (
    <button
      type="button"
      {...p}
      disabled={p.disabled || busy}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-xl font-bold whitespace-nowrap transition active:scale-[0.97] disabled:opacity-50',
        BTN[variant], SIZE[size], className,
      )}
    >
      {busy ? <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : Icon && <Icon className="size-4" />}
      {children}
    </button>
  );
}

export const Card = ({ className, red, as: As = 'div', ...p }) => (
  <As {...p} className={cx(red ? 'glass-red' : 'glass', 'rounded-2xl', className)} />
);

const TONE = {
  ok: 'bg-emerald-500/12 text-emerald-300 border-emerald-500/25',
  warn: 'bg-amber-500/12 text-amber-300 border-amber-500/25',
  bad: 'bg-red-500/12 text-red-300 border-red-500/30',
  mute: 'bg-white/5 text-silver border-white/10',
  brand: 'bg-brand/15 text-white border-brand/40',
};
export const Badge = ({ tone = 'mute', icon: Icon, children, className }) => (
  <span className={cx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold whitespace-nowrap', TONE[tone], className)}>
    {Icon && <Icon className="size-3" />}
    {children}
  </span>
);

export const Mono = ({ className, children, ...p }) => (
  <span dir="ltr" {...p} className={cx('mono', className)}>{children}</span>
);

export const Dot = ({ tone = 'ok' }) => (
  <span className="relative inline-flex size-2">
    <span className={cx('absolute inset-0 animate-ping rounded-full opacity-60', tone === 'ok' ? 'bg-ok' : tone === 'warn' ? 'bg-warn' : 'bg-brand2')} />
    <span className={cx('relative size-2 rounded-full', tone === 'ok' ? 'bg-ok' : tone === 'warn' ? 'bg-warn' : 'bg-brand2')} />
  </span>
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
      {label && (done ? 'کپی شد' : label)}
    </Btn>
  );
}

export function Progress({ value, tone, className, h = 'h-2' }) {
  const v = Math.max(0, Math.min(100, value));
  const color = tone ?? (v >= 90 ? 'bg-brand2' : v >= 70 ? 'bg-warn' : 'bg-ok');
  return (
    <div className={cx('w-full overflow-hidden rounded-full bg-white/8', h, className)} dir="ltr">
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

export function Modal({ open, onClose, title, icon: Icon, children, wide, footer }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="gutter fixed inset-0 z-50 flex items-center justify-center py-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={onClose} />
      <div className={cx('glass animate-rise relative flex max-h-full w-full flex-col rounded-2xl shadow-2xl shadow-black', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <div className="flex items-center gap-3 border-b border-white/8 px-5 py-4">
          {Icon && <span className="grid size-9 place-items-center rounded-xl bg-brand/15 text-brand2"><Icon className="size-5" /></span>}
          <h3 className="min-w-0 flex-1 truncate text-base font-black">{title}</h3>
          <button type="button" onClick={onClose} aria-label="بستن" className="grid size-8 place-items-center rounded-lg text-silver hover:bg-white/10 hover:text-white">
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/8 px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, icon: Icon, children }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="glass animate-rise absolute inset-y-0 left-0 flex w-full max-w-2xl flex-col border-y-0 border-l-0 shadow-2xl shadow-black">
        <div className="flex items-center gap-3 border-b border-white/8 px-5 py-4">
          {Icon && <span className="grid size-9 place-items-center rounded-xl bg-brand/15 text-brand2"><Icon className="size-5" /></span>}
          <h3 className="min-w-0 flex-1 truncate text-base font-black">{title}</h3>
          <button type="button" onClick={onClose} aria-label="بستن" className="grid size-8 place-items-center rounded-lg text-silver hover:bg-white/10 hover:text-white">
            <X className="size-4" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, hint, error, children, className }) {
  return (
    <label className={cx('flex min-w-0 flex-col gap-1.5', className)}>
      <span className="text-xs font-bold text-silver">{label}</span>
      {children}
      {error ? <span className="text-xs text-red-400">{error}</span> : hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

export function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      dir="ltr"
      className={cx('relative h-6 w-11 shrink-0 rounded-full border transition', checked ? 'border-emerald-400/40 bg-emerald-500/70' : 'border-white/10 bg-white/10')}
    >
      <span className={cx('absolute top-0.5 size-[18px] rounded-full bg-white transition-all', checked ? 'left-[22px]' : 'left-0.5')} />
    </button>
  );
}

export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={cx('flex gap-1 overflow-x-auto rounded-2xl border border-white/8 bg-card/80 p-1', className)} role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            'inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold whitespace-nowrap transition',
            value === t.id ? 'bg-brand-grad text-white shadow-lg shadow-red-600/20' : 'text-silver hover:bg-white/5 hover:text-white',
          )}
        >
          {t.icon && <t.icon className="size-4" />}
          {t.label}
          {t.count != null && <span className="mono rounded-md bg-black/30 px-1.5 text-[11px]">{t.count}</span>}
        </button>
      ))}
    </div>
  );
}

export const SectionTitle = ({ kicker, title, desc, action }) => (
  <div className="flex flex-wrap items-end justify-between gap-4">
    <div className="min-w-0">
      {kicker && <div className="mb-1 text-xs font-black tracking-wide text-brand2">{kicker}</div>}
      <h2 className="text-2xl font-black sm:text-3xl">{title}</h2>
      {desc && <p className="mt-2 max-w-2xl text-sm text-silver">{desc}</p>}
    </div>
    {action}
  </div>
);

export const Stat = ({ label, value, sub, icon: Icon, tone = 'text-white' }) => (
  <Card className="flex items-center gap-3 p-4">
    {Icon && <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/5 text-brand2"><Icon className="size-5" /></span>}
    <div className="min-w-0">
      <div className="truncate text-xs text-silver">{label}</div>
      <div className={cx('truncate text-lg font-black', tone)}>{value}</div>
      {sub && <div className="truncate text-[11px] text-zinc-500">{sub}</div>}
    </div>
  </Card>
);
