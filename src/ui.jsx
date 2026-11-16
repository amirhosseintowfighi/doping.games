import { useEffect, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';

export const cx = (...a) => a.filter(Boolean).join(' ');

const BTN = {
  primary: 'bg-brand-grad text-white shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_10px_30px_-10px_rgba(230,0,18,.8)] hover:brightness-110',
  ghost: 'bg-white/[0.05] text-zinc-100 shadow-[inset_0_0_0_1px_rgba(255,255,255,.1),inset_0_1px_0_rgba(255,255,255,.08)] hover:bg-white/[0.1] backdrop-blur-xl',
  outline: 'text-white shadow-[inset_0_0_0_1px_rgba(255,30,39,.5)] hover:bg-brand/15',
  danger: 'bg-red-500/[0.08] text-red-200 shadow-[inset_0_0_0_1px_rgba(239,68,68,.3)] hover:bg-red-500/20',
  ok: 'bg-emerald-500/[0.08] text-emerald-300 shadow-[inset_0_0_0_1px_rgba(16,185,129,.3)] hover:bg-emerald-500/20',
};
const SIZE = { sm: 'h-8 px-3.5 text-xs gap-1.5', md: 'h-10 px-5 text-[13px] gap-2', lg: 'h-12 px-7 text-sm gap-2.5' };
const SQUARE = { sm: 'size-8', md: 'size-10', lg: 'size-12' };

export function Btn({ variant = 'primary', size = 'md', icon: Icon, children, className, busy, ...p }) {
  return (
    <button
      type="button"
      {...p}
      disabled={p.disabled || busy}
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-bold whitespace-nowrap transition duration-200 active:scale-[0.97] disabled:opacity-40',
        BTN[variant], children == null ? SQUARE[size] : SIZE[size], className,
      )}
    >
      {busy ? <span className="size-4 animate-spin rounded-full border border-white/30 border-t-white" /> : Icon && <Icon className="size-4" />}
      {children}
    </button>
  );
}

/** Frosted panel. `red` adds the crimson key light; `as` swaps the element. */
export const Card = ({ className, red, as: As = 'div', ...p }) => (
  <As {...p} className={cx('relative rounded-2xl', red ? 'glass-red' : 'glass', className)} />
);

const TONE = {
  ok: 'text-emerald-300 shadow-[inset_0_0_0_1px_rgba(16,185,129,.28)] bg-emerald-500/[0.07]',
  warn: 'text-amber-300 shadow-[inset_0_0_0_1px_rgba(245,158,11,.28)] bg-amber-500/[0.07]',
  bad: 'text-red-300 shadow-[inset_0_0_0_1px_rgba(239,68,68,.35)] bg-red-500/[0.08]',
  mute: 'text-zinc-400 shadow-[inset_0_0_0_1px_rgba(255,255,255,.1)] bg-white/[0.03]',
  brand: 'text-white shadow-[inset_0_0_0_1px_rgba(255,30,39,.5)] bg-brand/[0.12]',
};
export const Badge = ({ tone = 'mute', icon: Icon, children, className }) => (
  <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap', TONE[tone], className)}>
    {Icon && <Icon className="size-3" />}
    {children}
  </span>
);

export const Mono = ({ className, children, ...p }) => (
  <span dir="ltr" {...p} className={cx('mono', className)}>{children}</span>
);

export const Dot = ({ tone = 'ok' }) => {
  const c = tone === 'ok' ? 'bg-ok' : tone === 'warn' ? 'bg-warn' : 'bg-brand2';
  return (
    <span className="relative inline-flex size-1.5">
      <span className={cx('absolute -inset-1 animate-ping rounded-full opacity-40', c)} />
      <span className={cx('relative size-1.5 rounded-full', c)} />
    </span>
  );
};

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
  const color = tone ?? (v >= 90 ? 'bg-brand2 shadow-[0_0_10px_#ff1e27]' : v >= 70 ? 'bg-warn shadow-[0_0_10px_#f59e0b]' : 'bg-ok shadow-[0_0_10px_#10b981]');
  return (
    <div className={cx('w-full rounded-full bg-white/[0.07]', h, className)} dir="ltr">
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

const Head = ({ title, icon: Icon, onClose }) => (
  <div className="flex items-center gap-3 px-6 pt-5 pb-4">
    {Icon && <span className="well grid size-10 place-items-center rounded-full text-brand2"><Icon className="size-[18px]" /></span>}
    <h3 className="min-w-0 flex-1 truncate text-base font-black">{title}</h3>
    <button type="button" onClick={onClose} aria-label="بستن" className="grid size-8 place-items-center rounded-full text-zinc-500 transition hover:bg-white/10 hover:text-white">
      <X className="size-4" />
    </button>
  </div>
);

export function Modal({ open, onClose, title, icon, children, wide, footer }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="gutter fixed inset-0 z-50 flex items-center justify-center py-6" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className={cx('glass animate-rise relative flex max-h-full w-full flex-col rounded-[28px]', wide ? 'max-w-3xl' : 'max-w-lg')}>
        <Head title={title} icon={icon} onClose={onClose} />
        <div className="hairline mx-6" />
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 px-6 pt-2 pb-5">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, title, icon, children }) {
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={onClose} />
      <div className="glass animate-rise absolute inset-y-3 left-3 flex w-[calc(100%-1.5rem)] max-w-2xl flex-col rounded-[28px]">
        <Head title={title} icon={icon} onClose={onClose} />
        <div className="hairline mx-6" />
        <div className="min-h-0 flex-1 overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

export function Field({ label, hint, error, children, className }) {
  return (
    <label className={cx('flex min-w-0 flex-col gap-2', className)}>
      <span className="text-xs text-zinc-400">{label}</span>
      {children}
      {error ? <span className="text-xs text-red-400">{error}</span> : hint && <span className="text-xs text-zinc-600">{hint}</span>}
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
      className={cx('relative h-6 w-11 shrink-0 rounded-full transition duration-300', checked ? 'bg-emerald-500/80 shadow-[0_0_16px_-2px_#10b981]' : 'bg-white/10 shadow-[inset_0_0_0_1px_rgba(255,255,255,.1)]')}
    >
      <span className={cx('absolute top-[3px] size-[18px] rounded-full bg-white shadow transition-all duration-300', checked ? 'left-[23px]' : 'left-[3px]')} />
    </button>
  );
}

/** Quiet segmented control: the active item lifts onto glass, a crimson tick marks it. */
export function Tabs({ tabs, value, onChange, className }) {
  return (
    <div className={cx('flex gap-1 overflow-x-auto', className)} role="tablist">
      {tabs.map((t) => {
        const on = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.id)}
            className={cx('inline-flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-[13px] whitespace-nowrap transition', on ? 'bg-white/[0.08] font-bold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.12)]' : 'text-zinc-500 hover:text-white')}
          >
            {t.icon && <t.icon className={cx('size-4', on && 'text-brand2')} />}
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

/** Side rail on desktop, scrollable strip on phones. Used by the gamer panel and the admin center. */
export function RailLayout({ tabs, value, onChange, children, foot }) {
  return (
    <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-[236px_minmax(0,1fr)] lg:gap-8">
      <div className="min-w-0 lg:sticky lg:top-28 lg:self-start">
        <nav className="glass relative flex gap-1 overflow-x-auto rounded-2xl p-2 lg:flex-col" role="tablist">
          {tabs.map((t) => {
            const on = value === t.id;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => onChange(t.id)}
                className={cx('flex shrink-0 items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] whitespace-nowrap transition', on ? 'bg-white/[0.07] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.08)]' : 'text-zinc-500 hover:bg-white/[0.03] hover:text-white')}
              >
                <t.icon className={cx('size-4', on && 'text-brand2 drop-shadow-[0_0_6px_#ff1e27]')} />
                <span className="flex-1 text-start">{t.label}</span>
                {t.count != null && <span className="mono text-[11px] text-zinc-600">{t.count}</span>}
              </button>
            );
          })}
        </nav>
        {foot && <div className="mt-4 hidden lg:block">{foot}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export const SectionTitle = ({ kicker, eyebrow, title, desc, action }) => (
  <div className="flex flex-wrap items-end justify-between gap-6">
    <div className="min-w-0">
      {eyebrow && <div className="eyebrow mb-3">{eyebrow}</div>}
      {kicker && <div className="mb-2 text-xs text-brand2">{kicker}</div>}
      <h2 className="text-3xl leading-tight font-light sm:text-[2.6rem]">{title}</h2>
      {desc && <p className="mt-3 max-w-xl text-sm text-zinc-400">{desc}</p>}
    </div>
    {action}
  </div>
);

/** HUD readout: label above, value below, no icon box. */
export const Stat = ({ label, value, sub, icon: Icon, tone = 'text-white' }) => (
  <Card className="p-5">
    <div className="flex items-center justify-between gap-2 text-xs text-zinc-500">
      <span className="truncate">{label}</span>
      {Icon && <Icon className="size-4 shrink-0 text-zinc-600" />}
    </div>
    <div className={cx('mt-2 truncate text-3xl font-light', tone)}>{value}</div>
    {sub && <div className="mt-1 truncate text-[11px] text-zinc-600">{sub}</div>}
  </Card>
);
