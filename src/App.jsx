import { useEffect, useState } from 'react';
import { CircleAlert, CircleCheck } from 'lucide-react';
import DopingLogo from './Logo.jsx';
import { SpeedBars } from './art.jsx';
import { StoreProvider, useStore } from './store.jsx';
import { cx, Mono } from './ui.jsx';
import { fa } from './data.js';
import Storefront from './views/Storefront.jsx';
import UserPanel from './views/UserPanel.jsx';
import Admin from './views/Admin.jsx';
import Blueprint from './views/Blueprint.jsx';

const VIEWS = [
  { id: 'store', label: 'فروشگاه و سرورها', short: 'فروشگاه', C: Storefront },
  { id: 'panel', label: 'پنل گیمر', short: 'پنل', C: UserPanel },
  { id: 'admin', label: 'مدیریت و میکروتیک', short: 'مدیریت', C: Admin },
  { id: 'blueprint', label: 'معماری و امنیت', short: 'معماری', C: Blueprint },
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
    <div className="relative isolate min-h-screen">
      {/* The trail from the logo, fixed behind every screen so the glass always has colour to refract. */}
      {view !== 'store' && (
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
          <SpeedBars dim className="absolute top-[52%] left-0 w-[46%]" />
        </div>
      )}

      <header className="sticky z-40 border-b border-white/10 bg-ink/75 backdrop-blur-2xl" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="gutter mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-1 py-2.5">
          <button type="button" onClick={() => go('store')} aria-label="دوپینگ · صفحه اصلی" className="shrink-0">
            <DopingLogo className="h-7 sm:h-8" />
          </button>
          <nav className="order-3 flex w-full gap-1 overflow-x-auto px-1 lg:order-none lg:w-auto" aria-label="محیط‌های پلتفرم">
            {VIEWS.map((v) => {
              const on = view === v.id;
              return (
                <button
                  key={v.id} type="button" onClick={() => go(v.id)} aria-current={on ? 'page' : undefined}
                  className={cx('para flex-1 shrink-0 px-4 py-2 text-[13px] font-black whitespace-nowrap transition-colors duration-150 lg:flex-none', on ? 'bg-white text-black' : 'text-zinc-400 hover:text-white')}
                >
                  <span className="block"><span className="hidden sm:inline">{v.label}</span><span className="sm:hidden">{v.short}</span></span>
                </button>
              );
            })}
          </nav>
          <button type="button" onClick={() => go('panel')} className="ms-auto flex items-center gap-3 text-xs transition hover:text-brand2">
            <span className="text-end leading-tight">
              <Mono className="block font-bold">Arash_AWP</Mono>
              <span className="text-zinc-400">{fa(s.wallet)} تومان</span>
            </span>
            <span className="para grid h-9 w-9 place-items-center bg-brand font-black text-white"><span>A</span></span>
          </button>
        </div>
      </header>

      <main key={view} className="animate-rise">
        <Current go={go} />
      </main>

      <footer className="gutter mx-auto mt-28 max-w-7xl border-t border-white/10 py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-500">
          <DopingLogo className="h-6" />
          <p>دوپینگ، شبکه گیمینگ ایران · <Mono>doping.games</Mono></p>
          <p>نسخه نمایشی: داده‌ها در مرورگر شبیه‌سازی می‌شوند و به روتر واقعی وصل نیستند.</p>
        </div>
      </footer>

      <div className="gutter pointer-events-none fixed inset-x-0 bottom-5 z-[70] flex flex-col items-center gap-2" aria-live="polite">
        {s.toasts.map((t) => (
          <div key={t.id} className={cx('animate-rise pointer-events-auto flex max-w-md items-center gap-2.5 px-5 py-3 text-[13px] font-bold', t.tone === 'ok' ? 'bg-white text-black' : t.tone === 'bad' ? 'bg-brand text-white' : 'bg-warn text-black')}>
            {t.tone === 'ok' ? <CircleCheck className="size-4 shrink-0" /> : <CircleAlert className="size-4 shrink-0" />}
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
