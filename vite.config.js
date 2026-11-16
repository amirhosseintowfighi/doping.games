import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// SINGLE=1 npm run build → one self-contained dist/index.html (fonts, CSS and JS inlined).
export default defineConfig({
  plugins: [react(), tailwindcss(), ...(process.env.SINGLE ? [viteSingleFile()] : [])],
  build: process.env.SINGLE ? { assetsInlineLimit: 100_000_000, chunkSizeWarningLimit: 4000 } : {},
});
