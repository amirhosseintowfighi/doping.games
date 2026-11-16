import { useEffect, useState } from 'react';
import { Blocks, CircleAlert, CircleCheck, Gamepad2, ShieldCheck, Store, Wallet } from 'lucide-react';
import DopingLogo from './Logo.jsx';
import { StoreProvider, useStore } from './store.jsx';
import { cx, Mono } from './ui.jsx';
import { fa } from './data.js';
import Storefront from './views/Storefront.jsx';
import UserPanel from './views/UserPanel.jsx';
import Admin from './views/Admin.jsx';
import Blueprint from './views/Blueprint.jsx';

const VIEWS = [
  { id: 'store', label: 'فروشگاه و سرورها', short: 'فروشگاه', icon: Store, C: Storefront },
  { id: 'panel', label: 'پنل گیمر', short: 'پنل', icon: Gamepad2, C: UserPanel },
  { id: 'admin', label: 'مدیریت و میکروتیک', short: 'مدیریت', icon: ShieldCheck, C: Admin },
  { id: 'blueprint', label: 'معماری و امنیت', short: 'معماری', icon: Blocks, C: Blueprint },
];
const fromHash = () => VIEWS.find((v) => `#${v.id}` === window.location.hash)?.id ?? 'store';

function Shell() {
  const { s } = useStore();
  const [view, setView] = useState(fromHash);

  useEffect(() => {
    const h = () => setView(fromHash());
    window.addEventListener('hashchange', h);
    return () => window.removeEventListener('hashchange', h);
  }, []);
  const go = (id) => {
    setView(id);
    try { window.location.hash = id; } catch { /* hash is a convenience only */ }
    window.scrollTo({ top: 0 });
  };
  const Current = VIEWS.find((v) => v.id === view).C;

  return (
    <div className="min-h-screen">
      <header className="sticky z-40 border-b border-white/8 bg-ink/80 backdrop-blur-xl" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="gutter mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-2 py-2.5">
          <button type="button" onClick={() => go('store')} aria-label="دوپینگ · صفحه اصلی" className="shrink-0">
            <DopingLogo className="h-7 sm:h-8" />
          </button>
          <nav className="order-3 flex w-full gap-1 overflow-x-auto rounded-xl border border-white/8 bg-card/70 p-1 lg:order-none lg:mx-auto lg:w-auto" aria-label="محیط‌های پلتفرم">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => go(v.id)}
                aria-current={view === v.id ? 'page' : undefined}
                className={cx(
                  'inline-flex flex-1 shrink-0 items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-[13px] font-bold whitespace-nowrap transition lg:flex-none',
                  view === v.id ? 'bg-brand-grad text-white shadow-md shadow-red-600/30' : 'text-silver hover:bg-white/5 hover:text-white',
                )}
              >
                <v.icon className="size-4" />
                <span className="hidden sm:inline">{v.label}</span>
                <span className="sm:hidden">{v.short}</span>
              </button>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-2 lg:ms-0">
            <button type="button" onClick={() => go('panel')} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold hover:bg-white/10">
              <Wallet className="size-4 text-brand2" />
              <span>{fa(s.wallet)}</span>
              <span className="text-silver">تومان</span>
            </button>
            <button type="button" onClick={() => go('panel')} className="hidden items-center gap-2 rounded-xl border border-white/10 bg-white/5 py-1 ps-1 pe-3 text-xs font-bold hover:bg-white/10 sm:flex">
              <span className="bg-brand-grad grid size-7 place-items-center rounded-lg text-sm font-black">A</span>
              <Mono>Arash_AWP</Mono>
            </button>
          </div>
        </div>
      </header>

      <main key={view} className="animate-rise">
        <Current go={go} />
      </main>

      <footer className="gutter mx-auto mt-16 max-w-7xl border-t border-white/8 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-silver">
          <DopingLogo className="h-6 opacity-90" />
          <p>دوپینگ · شبکه گیمینگ ایران · <Mono>doping.games</Mono></p>
          <p className="text-zinc-500">نسخه نمایشی: داده‌ها در مرورگر شبیه‌سازی می‌شوند و به روتر واقعی وصل نیستند.</p>
        </div>
      </footer>

      <div className="gutter pointer-events-none fixed inset-x-0 bottom-4 z-[70] flex flex-col items-center gap-2" aria-live="polite">
        {s.toasts.map((t) => (
          <div key={t.id} className={cx('glass animate-rise pointer-events-auto flex max-w-md items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold shadow-xl shadow-black', t.tone === 'bad' && 'border-red-500/40', t.tone === 'warn' && 'border-amber-500/40')}>
            {t.tone === 'ok' ? <CircleCheck className="size-4 shrink-0 text-ok" /> : <CircleAlert className={cx('size-4 shrink-0', t.tone === 'bad' ? 'text-brand2' : 'text-warn')} />}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
