'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { CircleAlert, CircleCheck, LogOut, X } from 'lucide-react';
import DopingLogo from './Logo.jsx';
import { useStore } from './store.jsx';
import { BackToTop, ScrollProgress, useSpotlight } from './motion.jsx';
import { cx, Mono } from './ui.jsx';
import { fa } from './data.js';

export default function Shell({ children }) {
  const { s, api, toast } = useStore();
  const path = usePathname();
  useSpotlight();
  const [bannerClosed, setBannerClosed] = useState('');
  const banner = s.site.banner;
  const showBanner = banner.on && banner.text.trim() && bannerClosed !== banner.text;
  const u = s.user;
  const nav = [
    { href: '/', label: 'فروشگاه و سرورها', short: 'فروشگاه' },
    { href: '/panel', label: 'پنل گیمر', short: 'پنل' },
    ...(u && (u.role === 'admin' || u.role === 'support') ? [{ href: '/admin', label: 'مدیریت و میکروتیک', short: 'مدیریت' }] : []),
  ];
  const active = (href) => (href === '/' ? path === '/' : path.startsWith(href));
  const logout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
      window.location.href = '/';
    } catch (err) {
      toast(err.message, 'bad');
    }
  };

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
          <Link href="/" aria-label="دوپینگ · صفحه اصلی" className="shrink-0 py-2">
            <DopingLogo className="h-6 sm:h-7" />
          </Link>
          <nav className="order-3 -mx-2 flex w-[calc(100%+1rem)] overflow-x-auto sm:mx-0 sm:w-full sm:gap-5 lg:order-none lg:w-auto" aria-label="بخش‌های سایت">
            {nav.map((v) => (
              <Link
                key={v.href} href={v.href} aria-current={active(v.href) ? 'page' : undefined}
                className={cx('flex min-h-10 flex-1 shrink-0 items-center justify-center border-b-2 px-2 py-2 text-[13px] whitespace-nowrap transition-colors sm:flex-none sm:px-0', active(v.href) ? 'border-white font-bold text-white' : 'border-transparent text-zinc-400 hover:text-white')}
              >
                <span className="hidden sm:inline">{v.label}</span><span className="sm:hidden">{v.short}</span>
              </Link>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-2">
            {u ? (
              <>
                <Link href="/panel" className="flex h-9 items-center gap-2.5 rounded-xl bg-white px-3.5 text-xs font-bold text-black transition-colors hover:bg-zinc-200">
                  <Mono>{u.username}</Mono>
                  <span className="font-normal text-zinc-600">{fa(u.wallet)} تومان</span>
                </Link>
                <button type="button" onClick={logout} aria-label="خروج از حساب" title="خروج" className="grid size-9 place-items-center rounded-xl text-zinc-400 hover:bg-white/10 hover:text-white">
                  <LogOut className="size-4" />
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="flex h-9 items-center rounded-xl px-3 text-xs font-bold text-zinc-200 hover:bg-white/10">ورود</Link>
                <Link href="/register" className="flex h-9 items-center rounded-xl bg-white px-3.5 text-xs font-bold text-black hover:bg-zinc-200">ثبت‌نام</Link>
              </>
            )}
          </div>
        </div>
        <ScrollProgress />
      </header>

      <main className="animate-rise">{children}</main>

      <footer className="gutter mx-auto mt-24 max-w-6xl border-t border-line py-8">
        <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-500">
          <DopingLogo className="h-5" />
          <p>{s.site.footer} · <Mono>doping.games</Mono></p>
        </div>
      </footer>

      <BackToTop />

      <div className="gutter pointer-events-none fixed inset-x-0 bottom-5 z-[70] flex flex-col items-center gap-2" aria-live="polite">
        {s.toasts.map((t) => (
          <div key={t.id} className="animate-rise pointer-events-auto flex max-w-md items-center gap-2.5 rounded-xl border border-edge bg-raise px-4 py-2.5 text-[13px] shadow-2xl shadow-black" data-tone={t.tone}>
            {t.tone === 'ok' ? <CircleCheck className="size-4 shrink-0 text-ok" /> : <CircleAlert className={cx('size-4 shrink-0', t.tone === 'bad' ? 'text-brand2' : 'text-warn')} />}
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
