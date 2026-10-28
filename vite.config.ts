import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// BASE задаётся при сборке под GitHub Pages (/<repo>/); для Capacitor и локально — '/'.
const base = process.env.BASE ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Xalça',
        short_name: 'Xalça',
        description: 'Трекер задач',
        lang: 'az',
        theme_color: '#7a1f2b',
        background_color: '#f6efe3',
        display: 'standalone',
        start_url: base,
        scope: base,
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        // APK и файлы обновлений должны скачиваться, а не подменяться страницей приложения.
        navigateFallbackDenylist: [/\.apk$/, /\/update\//],
      },
    }),
  ],
  test: { environment: 'node' },
});
