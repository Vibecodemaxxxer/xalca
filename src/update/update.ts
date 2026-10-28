import { App } from '@capacitor/app';
import { CapacitorUpdater } from '@capgo/capacitor-updater';
import { isNative } from '../notify/notify';

// Автообновление Android-приложения: при запуске и возврате в приложение проверяем
// version.json на GitHub Pages, скачиваем новый веб-бандл и применяем при следующем открытии.
// Если обновление требует новой нативной части (minNative), показываем ссылку на APK.

export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION || 'dev';
const UPDATE_URL: string = import.meta.env.VITE_UPDATE_URL || '';

interface Manifest {
  version: string;
  bundle: string;
  minNative: number;
  apk?: string;
  notes?: string;
}

export type UpdateState =
  | { status: 'none' }
  | { status: 'ready'; version: string; notes?: string }
  | { status: 'native'; version: string; apk?: string };

let state: UpdateState = { status: 'none' };
const subs = new Set<(s: UpdateState) => void>();
export const getUpdateState = () => state;
export function onUpdateState(fn: (s: UpdateState) => void) {
  subs.add(fn);
  return () => subs.delete(fn);
}
const set = (s: UpdateState) => {
  state = s;
  subs.forEach((fn) => fn(s));
};

let checking = false;

export async function checkForUpdate() {
  if (!isNative || !UPDATE_URL || checking || !navigator.onLine) return;
  checking = true;
  try {
    const res = await fetch(`${UPDATE_URL}update/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const m: Manifest = await res.json();
    if (m.version === APP_VERSION) return;

    const native = Number((await App.getInfo()).build);
    if (native < m.minNative) return set({ status: 'native', version: m.version, apk: m.apk && new URL(m.apk, UPDATE_URL).href });

    // Уже скачан и ждёт применения?
    const { bundles } = await CapacitorUpdater.list();
    let bundle = bundles.find((b) => b.version === m.version && b.status !== 'error');
    if (!bundle) bundle = await CapacitorUpdater.download({ url: new URL(m.bundle, UPDATE_URL).href, version: m.version });
    await CapacitorUpdater.next({ id: bundle.id });
    set({ status: 'ready', version: m.version, notes: m.notes });
  } catch (e) {
    console.warn('update check failed', e);
  } finally {
    checking = false;
  }
}

/** Применить скачанное обновление прямо сейчас (перезапуск веб-части). */
export async function applyNow() {
  const next = await CapacitorUpdater.getNextBundle();
  if (next) await CapacitorUpdater.set({ id: next.id });
}

export async function initUpdates() {
  if (!isNative) return;
  // Сообщаем плагину, что новая версия запустилась нормально — иначе он откатится на прошлую.
  await CapacitorUpdater.notifyAppReady();
  setTimeout(() => void checkForUpdate(), 3000);
  void App.addListener('resume', () => void checkForUpdate());
}
