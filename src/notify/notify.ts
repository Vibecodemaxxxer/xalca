import { Capacitor } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { db } from '../db/db';
import { computeReminders, type Reminder } from '../domain/reminders';

export const isNative = Capacitor.isNativePlatform();

export async function permissionState(): Promise<'granted' | 'denied' | 'prompt'> {
  if (isNative) {
    const p = await LocalNotifications.checkPermissions();
    return p.display === 'granted' ? 'granted' : p.display === 'denied' ? 'denied' : 'prompt';
  }
  if (!('Notification' in window)) return 'denied';
  return Notification.permission === 'default' ? 'prompt' : Notification.permission;
}

export async function requestPermission() {
  if (isNative) {
    await LocalNotifications.requestPermissions();
    // Android 12+: точные будильники, иначе напоминания могут опаздывать.
    const ex = await LocalNotifications.checkExactNotificationSetting().catch(() => null);
    if (ex && ex.exact_alarm !== 'granted') await LocalNotifications.changeExactNotificationSetting();
  } else if ('Notification' in window) {
    await Notification.requestPermission();
  }
  await reschedule();
}

// ---- ПК / браузер: таймеры, пока приложение открыто ----
const webTimers = new Map<number, ReturnType<typeof setTimeout>>();

async function showWeb(r: Reminder) {
  const reg = await navigator.serviceWorker?.getRegistration();
  if (reg) await reg.showNotification(r.title, { body: r.body, tag: String(r.id), icon: 'pwa-192x192.png' });
  else new Notification(r.title, { body: r.body });
}

function scheduleWeb(list: Reminder[]) {
  webTimers.forEach(clearTimeout);
  webTimers.clear();
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const limit = Date.now() + 24 * 3600_000; // setTimeout не любит большие задержки
  for (const r of list) {
    if (+r.at > limit) break;
    webTimers.set(r.id, setTimeout(() => void showWeb(r), +r.at - Date.now()));
  }
}

// ---- Android: системные будильники, работают при закрытом приложении ----
async function scheduleNative(list: Reminder[]) {
  if ((await LocalNotifications.checkPermissions()).display !== 'granted') return;
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
  if (!list.length) return;
  await LocalNotifications.schedule({
    notifications: list.slice(0, 400).map((r) => ({
      id: r.id,
      title: r.title,
      body: r.body,
      schedule: { at: r.at, allowWhileIdle: true },
      channelId: 'reminders',
      smallIcon: 'ic_stat_xalca',
    })),
  });
}

let busy: Promise<void> = Promise.resolve();

/** Пересчитать и заново запланировать все напоминания. */
export function reschedule() {
  busy = busy.then(async () => {
    const [tasks, routines, logs] = await Promise.all([db.tasks.toArray(), db.routines.toArray(), db.routineLogs.toArray()]);
    const list = computeReminders(tasks, routines, logs);
    if (isNative) await scheduleNative(list);
    else scheduleWeb(list);
  }).catch((e) => console.error('reminders', e));
  return busy;
}

export async function initNotifications() {
  if (isNative) {
    await LocalNotifications.createChannel({ id: 'reminders', name: 'Xatırlatmalar', importance: 5, vibration: true }).catch(() => {});
  }
  await reschedule();
  setInterval(() => void reschedule(), 3600_000);
}
