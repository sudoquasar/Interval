/// <reference types="vitest/config" />
import { copyFileSync, existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

function withTrailingSlash(path: string): string {
  return path.endsWith('/') ? path : `${path}/`;
}

/** The nightly job stamps `meta.json`; its timestamp busts every data URL after a deploy. */
function readDataVersion(): string {
  const metaPath = resolve(root, 'public/data/meta.json');
  if (!existsSync(metaPath)) return 'dev';
  try {
    const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as { generated?: string };
    return meta.generated ?? 'dev';
  } catch {
    return 'dev';
  }
}

/** GitHub Pages serves 404.html for unknown paths, which lets the router boot on deep links. */
function spaFallback(enabled: boolean): Plugin {
  let outDir = 'dist';
  return {
    name: 'interval:spa-404',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      if (enabled) copyFileSync(resolve(outDir, 'index.html'), resolve(outDir, '404.html'));
    },
  };
}

/** Starts the hero's catalogue fetch in parallel with the JS bundle instead of after it. */
function preloadHeroData(base: string, version: string): Plugin {
  return {
    name: 'interval:preload-hero-data',
    apply: 'build',
    transformIndexHtml() {
      if (!existsSync(resolve(root, 'public/data/catalog/trending.json'))) return [];
      return [
        {
          tag: 'link',
          attrs: {
            rel: 'preload',
            as: 'fetch',
            crossorigin: 'anonymous',
            href: `${base}data/catalog/trending.json?v=${encodeURIComponent(version)}`,
          },
          injectTo: 'head',
        },
      ];
    },
  };
}

export default defineConfig(() => {
  const base = withTrailingSlash(process.env.BASE_PATH || '/');
  const dataVersion = readDataVersion();

  return {
    base,
    plugins: [
      react(),
      tailwindcss(),
      spaFallback(process.env.SPA_404 === 'true'),
      preloadHeroData(base, dataVersion),
    ],
    define: {
      'import.meta.env.VITE_DATA_VERSION': JSON.stringify(dataVersion),
    },
    test: {
      include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
      environment: 'node',
    },
  };
});
