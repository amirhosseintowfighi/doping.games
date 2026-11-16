import { useEffect, useState } from 'react';
import { Blocks, CircleAlert, CircleCheck, Gamepad2, ShieldCheck, Store, Wallet } from 'lucide-react';
import DopingLogo from './Logo.jsx';
import { StoreProvider, useStore } from './store.jsx';
import { cx, Dot, Mono } from './ui.jsx';
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
  const nodesUp = s.routers.filter((r) => r.status === 'online').length;

  return (
    <div className="relative isolate min-h-screen">
      <div className="ambient" aria-hidden="true">
        <DopingLogo variant="mark" className="absolute -bottom-24 -left-20 h-[38rem] opacity-[0.035] blur-[1px]" />
      </div>

      <header className="gutter sticky z-40 pt-3" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="glass relative mx-auto flex max-w-6xl flex-wrap items-center gap-x-3 gap-y-2 rounded-[26px] px-3 py-2 lg:rounded-full lg:ps-6">
          <button type="button" onClick={() => go('store')} aria-label="دوپینگ · صفحه اصلی" className="shrink-0 py-1">
            <DopingLogo className="h-6 sm:h-7" />
          </button>
          <nav className="order-3 flex w-full gap-1 overflow-x-auto lg:order-none lg:mx-auto lg:w-auto" aria-label="محیط‌های پلتفرم">
            {VIEWS.map((v) => {
              const on = view === v.id;
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => go(v.id)}
                  aria-current={on ? 'page' : undefined}
                  className={cx(
                    'relative inline-flex flex-1 shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2 text-[13px] whitespace-nowrap transition duration-300 lg:flex-none',
                    on ? 'bg-white/[0.09] font-bold text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,.12),inset_0_1px_0_rgba(255,255,255,.1)]' : 'text-zinc-500 hover:text-white',
                  )}
                >
                  <v.icon className={cx('size-4', on && 'text-brand2 drop-shadow-[0_0_6px_#ff1e27]')} />
                  <span className="hidden sm:inline">{v.label}</span>
                  <span className="sm:hidden">{v.short}</span>
                </button>
              );
            })}
          </nav>
          <div className="ms-auto flex items-center gap-2 lg:ms-0">
            <span className="hidden items-center gap-2 px-2 xl:flex">
              <Dot tone={nodesUp === s.routers.length ? 'ok' : 'warn'} />
              <Mono className="eyebrow">{nodesUp}/{s.routers.length} nodes</Mono>
            </span>
            <button type="button" onClick={() => go('panel')} className="flex h-9 items-center gap-2 rounded-full bg-white/[0.05] px-3.5 text-xs shadow-[inset_0_0_0_1px_rgba(255,255,255,.1)] transition hover:bg-white/10">
              <Wallet className="size-4 text-brand2" />
              <span className="font-bold">{fa(s.wallet)}</span>
              <span className="text-zinc-500">تومان</span>
            </button>
            <button type="button" onClick={() => go('panel')} aria-label="پنل Arash_AWP" className="bg-brand-grad grid size-9 place-items-center rounded-full text-sm font-black shadow-[inset_0_1px_0_rgba(255,255,255,.35),0_0_20px_-4px_#e60012]">
              A
            </button>
          </div>
        </div>
      </header>

      <main key={view} className="animate-rise">
        <Current go={go} />
      </main>

      <footer className="gutter mx-auto mt-24 max-w-7xl pb-10">
        <div className="hairline" />
        <div className="flex flex-wrap items-center justify-between gap-4 pt-8 text-xs text-zinc-500">
          <DopingLogo className="h-5" />
          <Mono className="eyebrow">doping.games · gaming network · iran</Mono>
          <p className="text-zinc-600">نسخه نمایشی: داده‌ها در مرورگر شبیه‌سازی می‌شوند و به روتر واقعی وصل نیستند.</p>
        </div>
      </footer>

      <div className="gutter pointer-events-none fixed inset-x-0 bottom-5 z-[70] flex flex-col items-center gap-2" aria-live="polite">
        {s.toasts.map((t) => (
          <div key={t.id} className="glass animate-rise pointer-events-auto relative flex max-w-md items-center gap-2.5 rounded-full px-5 py-2.5 text-[13px]">
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
