import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/**
 * Preloads the Persian and Latin Vazirmatn files, so the hero headline does not wait for the
 * stylesheet and script before its font starts downloading. No-op in the single-file build,
 * where fonts are inlined.
 */
const preloadFonts = () => ({
  name: 'doping-preload-fonts',
  transformIndexHtml: {
    order: 'post',
    handler(_html, ctx) {
      const files = Object.keys(ctx.bundle ?? {}).filter((f) => /vazirmatn-(arabic|latin)-wght-normal-[\w-]+\.woff2$/.test(f));
      return files.map((f) => ({ tag: 'link', attrs: { rel: 'preload', as: 'font', type: 'font/woff2', href: `/${f}`, crossorigin: '' }, injectTo: 'head' }));
    },
  },
});

// SINGLE=1 npm run build → one self-contained dist/index.html (fonts, CSS and JS inlined).
export default defineConfig({
  plugins: [react(), tailwindcss(), preloadFonts(), ...(process.env.SINGLE ? [viteSingleFile()] : [])],
  build: process.env.SINGLE ? { assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 4000 } : {},
});
