import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'az.xalca.app',
  appName: 'Xalça',
  webDir: 'dist',
  plugins: {
    // Обновления веб-кода с GitHub Pages; проверяем сами (src/update/update.ts),
    // серверы и статистику Capgo не используем.
    CapacitorUpdater: {
      autoUpdate: false,
      resetWhenUpdate: true,
      updateUrl: '',
      channelUrl: '',
      statsUrl: '',
    },
  },
};

export default config;
