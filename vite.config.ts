import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { buildManifest, type BrowserTarget } from './src/manifest';

const pkg = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };

/**
 * Emits manifest.json for the target browser and packages the data snapshot
 * (offline fallback) into the build.
 */
function extensionAssets(target: BrowserTarget): Plugin {
  return {
    name: 'fedlens-extension-assets',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: JSON.stringify(buildManifest(target, pkg.version), null, 2),
      });
      for (const file of readdirSync('data').filter((f) => f.endsWith('.json'))) {
        this.emitFile({
          type: 'asset',
          fileName: `data/${file}`,
          source: readFileSync(resolve('data', file)),
        });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const target: BrowserTarget = mode === 'firefox' ? 'firefox' : 'chrome';
  return {
    // Relative asset URLs are required inside chrome-extension:// pages.
    base: './',
    plugins: [react(), tailwindcss(), extensionAssets(target)],
    build: {
      outDir: `dist/${target}`,
      emptyOutDir: true,
      target: 'es2022',
      chunkSizeWarningLimit: 1500,
      rollupOptions: {
        input: { index: resolve('index.html'), background: resolve('src/background/index.ts') },
        output: {
          entryFileNames: (chunk) =>
            chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js',
        },
      },
    },
  };
});
