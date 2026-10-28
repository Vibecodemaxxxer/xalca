import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { getMeta, initDevice, onLocalChange } from './db/db';
import { initNotifications, isNative, reschedule } from './notify/notify';
import { onRemoteChange, startAutoSync } from './sync/sync';
import { initUpdates } from './update/update';
import { applyTheme, type Theme } from './ui/Settings';
import './ui/styles.css';

async function boot() {
  await initDevice();
  applyTheme((await getMeta<Theme>('theme')) ?? 'auto');

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );

  if (!isNative) {
    const { registerSW } = await import('virtual:pwa-register');
    registerSW({ immediate: true });
  }

  void initUpdates();
  startAutoSync();
  await initNotifications();

  let t: ReturnType<typeof setTimeout> | undefined;
  const later = () => {
    clearTimeout(t);
    t = setTimeout(() => void reschedule(), 1500);
  };
  onLocalChange(later);
  onRemoteChange(later);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && later());
}

void boot();
