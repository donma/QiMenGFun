import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/QiMenGFun/',
  plugins: [
    react(),
    VitePWA({
      // SW 自行 skipWaiting + clientsClaim；完整快取後才接管，工作中延後重載，不清 IndexedDB。
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png'],
      manifest: {
        id: '/QiMenGFun/',
        name: 'QiMenGFun 奇門吉方',
        short_name: 'QiMenGFun',
        description: '可安裝、離線、本機優先的實景奇門時空羅盤（傳統文化參考）。',
        lang: 'zh-Hant',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#041323',
        background_color: '#041323',
        start_url: '/QiMenGFun/',
        scope: '/QiMenGFun/',
        icons: [
          { src: '/QiMenGFun/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/QiMenGFun/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/QiMenGFun/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/QiMenGFun/index.html',
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    css: { include: [/\.css\?raw$/] },
  },
  server: { watch: { ignored: ['**/scripts/.cache/**'] } },
});
