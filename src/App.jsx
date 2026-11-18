import { lazy, Suspense, useEffect, useState } from 'react';
import { CircleAlert, CircleCheck, X } from 'lucide-react';
import DopingLogo from './Logo.jsx';
import { StoreProvider, useStore } from './store.jsx';
import { BackToTop, ScrollProgress, useSpotlight } from './motion.jsx';
import { cx, Mono } from './ui.jsx';
import { fa } from './data.js';
import Storefront from './views/Storefront.jsx';
// The storefront ships in the first bundle; the other views load when first opened.
const UserPanel = lazy(() => import('./views/UserPanel.jsx'));
const Admin = lazy(() => import('./views/Admin.jsx'));
const Blueprint = lazy(() => import('./views/Blueprint.jsx'));

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
  useSpotlight();
  const [bannerClosed, setBannerClosed] = useState('');
  const banner = s.site.banner;
  const showBanner = banner.on && banner.text.trim() && bannerClosed !== banner.text;

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
      {showBanner && (
        <div className="gutter relative z-40 flex items-center justify-center gap-3 bg-brand py-2 text-center text-[13px] font-bold text-white" role="status">
          <span className="min-w-0">{banner.text}</span>
          <button type="button" onClick={() => setBannerClosed(banner.text)} aria-label="بستن اطلاعیه" className="grid size-8 shrink-0 place-items-center rounded-lg hover:bg-black/20">
            <X className="size-4" />
          </button>
        </div>
      )}
      <header className="sticky z-40 border-b border-line bg-ink/85 backdrop-blur-xl" style={{ top: 'env(safe-area-inset-top, 0px)' }}>
        <div className="gutter mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-1 py-3">
          <button type="button" onClick={() => go('store')} aria-label="دوپینگ · صفحه اصلی" className="shrink-0 py-2">
            <DopingLogo className="h-6 sm:h-7" />
          </button>
          <nav className="order-3 -mx-2 flex w-[calc(100%+1rem)] overflow-x-auto sm:mx-0 sm:w-full sm:gap-5 lg:order-none lg:w-auto" aria-label="محیط‌های پلتفرم">
            {VIEWS.map((v) => (
              <button
                key={v.id} type="button" onClick={() => go(v.id)} aria-current={view === v.id ? 'page' : undefined}
                className={cx('min-h-10 flex-1 shrink-0 border-b-2 px-2 py-2 text-[13px] whitespace-nowrap transition-colors sm:flex-none sm:px-0', view === v.id ? 'border-white font-bold text-white' : 'border-transparent text-zinc-400 hover:text-white')}
              >
                <span className="hidden sm:inline">{v.label}</span><span className="sm:hidden">{v.short}</span>
              </button>
            ))}
          </nav>
          <button type="button" onClick={() => go('panel')} className="ms-auto flex h-9 items-center gap-2.5 rounded-xl bg-white px-3.5 text-xs font-bold text-black transition-colors hover:bg-zinc-200">
            <Mono>Arash_AWP</Mono>
            <span className="font-normal text-zinc-600">{fa(s.wallet)} تومان</span>
          </button>
        </div>
        <ScrollProgress />
      </header>

      <main key={view} className="animate-rise">
        <Suspense fallback={<div className="gutter mx-auto flex min-h-[60vh] max-w-6xl items-center justify-center text-sm text-zinc-500" role="status">در حال بارگذاری…</div>}>
          <Current go={go} />
        </Suspense>
      </main>

      <footer className="gutter mx-auto mt-24 max-w-6xl border-t border-line py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-500">
          <DopingLogo className="h-5" />
          <p>{s.site.footer} · <Mono>doping.games</Mono></p>
          <p>نسخه نمایشی: داده‌ها در مرورگر شبیه‌سازی می‌شوند و به روتر واقعی وصل نیستند.</p>
        </div>
      </footer>

      <BackToTop />

      <div className="gutter pointer-events-none fixed inset-x-0 bottom-5 z-[70] flex flex-col items-center gap-2" aria-live="polite">
        {s.toasts.map((t) => (
          <div key={t.id} className="animate-rise pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl border border-edge bg-raise px-4 py-2.5 text-[13px] shadow-2xl shadow-black">
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
