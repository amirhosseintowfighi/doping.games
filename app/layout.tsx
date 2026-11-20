import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import type { CSSProperties, ReactNode } from 'react';
import '@fontsource-variable/jetbrains-mono/index.css';
import './globals.css';
import { initialState } from '@/lib/server/initial';
import Shell from '@/src/Shell.jsx';
import { StoreProvider } from '@/src/store.jsx';

// Vazirmatn, self-hosted and preloaded. Latin first, then Arabic: the browser falls through per glyph,
// and next/font adds a size-matched fallback so the swap does not shift the hero.
const vazirLatin = localFont({ src: '../node_modules/@fontsource-variable/vazirmatn/files/vazirmatn-latin-wght-normal.woff2', weight: '100 900', variable: '--font-vazir-latin', display: 'swap' });
const vazirArabic = localFont({ src: '../node_modules/@fontsource-variable/vazirmatn/files/vazirmatn-arabic-wght-normal.woff2', weight: '100 900', variable: '--font-vazir-arabic', display: 'swap', adjustFontFallback: 'Arial' });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL || 'https://doping.games'),
  title: 'دوپینگ | پینگت رو دوپینگ کن',
  description: 'دوپینگ؛ کاهش پینگ، تانل گیمینگ، دی‌ان‌اس ضد تحریم و سرورهای اختصاصی CS2',
  alternates: { canonical: '/' },
  icons: { icon: '/favicon.svg' },
  openGraph: {
    type: 'website', locale: 'fa_IR', siteName: 'دوپینگ', url: '/',
    title: 'دوپینگ | پینگت رو دوپینگ کن',
    description: 'تانل اختصاصی گیمینگ از ایران تا عمان، امارات و اروپا. پینگ پایین، بدون پکت لاس، بدون تحریم.',
  },
  twitter: { card: 'summary' },
};

export const viewport: Viewport = { themeColor: '#08080a', width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const initial = await initialState();
  const accent = initial.site.accent;
  const theme = { '--color-brand': accent, '--color-brand2': `color-mix(in srgb, ${accent} 82%, white)` } as CSSProperties;
  return (
    <html lang="fa" dir="rtl" style={theme} className={`${vazirLatin.variable} ${vazirArabic.variable}`}>
      <body>
        <StoreProvider initial={initial}>
          <Shell>{children}</Shell>
        </StoreProvider>
      </body>
    </html>
  );
}
