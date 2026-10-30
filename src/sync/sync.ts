import type { Table } from 'dexie';
import { db, getMeta, onLocalChange, setMeta } from '../db/db';
import { observe } from '../db/hlc';
import { SYNC_TABLES, type Base } from '../db/types';
import { download, isConnected, listFolder, upload } from './dropbox';
import { uploadPending } from './images';
import { maxStamp, mergeRecord } from './merge';

// Схема в Dropbox: /data/<deviceId>.json — полный снимок данных каждого устройства.
// Каждое устройство пишет только свой файл и читает чужие, поэтому гонок записи нет.

interface Snapshot {
  version: 1;
  deviceId: string;
  exportedAt: number;
  tables: Record<string, Base[]>;
}

export type SyncState = { status: 'off' | 'idle' | 'syncing' | 'error'; lastSync?: number; error?: string };

let state: SyncState = { status: 'off' };
const subs = new Set<(s: SyncState) => void>();
const remoteSubs = new Set<() => void>();

export const getSyncState = () => state;
export function onSyncState(fn: (s: SyncState) => void) {
  subs.add(fn);
  return () => subs.delete(fn);
}
/** Вызывается, когда пришли изменения с другого устройства. */
export function onRemoteChange(fn: () => void) {
  remoteSubs.add(fn);
  return () => remoteSubs.delete(fn);
}

function setState(s: Partial<SyncState>) {
  state = { ...state, ...s };
  subs.forEach((fn) => fn(state));
}

let running: Promise<void> | null = null;
let again = false;
/** Счётчик локальных правок и номер последней, уже выгруженной в Dropbox. */
let edits = 0;
let sent = 0;

export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await syncOnce();
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function syncOnce() {
  if (!(await isConnected())) return setState({ status: 'off' });
  if (!navigator.onLine) return;
  setState({ status: 'syncing', error: undefined });
  try {
    const deviceId = (await getMeta<string>('deviceId'))!;
    const seen = (await getMeta<Record<string, string>>('sync.seen')) ?? {};

    // 1. Забрать изменения других устройств.
    let changed = 0;
    for (const e of await listFolder('/data')) {
      if (!e.name.endsWith('.json') || e.name === `${deviceId}.json`) continue;
      if (seen[e.name] === e.rev) continue;
      const snap: Snapshot = JSON.parse(await (await download(e.path)).text());
      changed += await applySnapshot(snap);
      seen[e.name] = e.rev;
    }
    await setMeta('sync.seen', seen);
    if (changed) remoteSubs.forEach((fn) => fn());

    // 2. Выгрузить свой снимок, если были локальные изменения.
    if (await getMeta<boolean>('sync.dirty') !== false) {
      await setMeta('sync.dirty', false);
      const upTo = edits;
      try {
        await upload(`/data/${deviceId}.json`, JSON.stringify(await exportSnapshot(deviceId)));
        sent = upTo;
      } catch (e) {
        await setMeta('sync.dirty', true);
        throw e;
      }
    }
    // 3. Картинки, добавленные офлайн.
    await uploadPending();
    setState({ status: 'idle', lastSync: Date.now() });
  } catch (e) {
    setState({ status: 'error', error: e instanceof Error ? e.message : String(e) });
  }
}

async function exportSnapshot(deviceId: string): Promise<Snapshot> {
  const tables: Record<string, Base[]> = {};
  for (const t of SYNC_TABLES) tables[t] = await db[t].toArray();
  return { version: 1, deviceId, exportedAt: Date.now(), tables };
}

async function applySnapshot(snap: Snapshot): Promise<number> {
  let changed = 0;
  for (const name of SYNC_TABLES) {
    const remote = snap.tables[name] ?? [];
    if (!remote.length) continue;
    const table = db[name] as unknown as Table<Base, string>;
    await db.transaction('rw', table, async () => {
      const local = await table.bulkGet(remote.map((r) => r.id));
      const out: Base[] = [];
      remote.forEach((r, i) => {
        const m = mergeRecord(local[i], r);
        if (m) out.push(m);
        observe(maxStamp(r));
      });
      if (out.length) await table.bulkPut(out);
      changed += out.length;
    });
  }
  return changed;
}

/**
 * Запуск автосинхронизации: при старте, при появлении сети, при возврате в приложение, после правок и раз в 5 минут.
 * Правки не ждут таймера, если приложение сворачивают: таймер мог бы уже не сработать — устройство заснёт, вкладку закроют.
 */
export function startAutoSync() {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    void syncNow();
  };
  onLocalChange(() => {
    edits++;
    void setMeta('sync.dirty', true);
    clearTimeout(timer);
    timer = setTimeout(flush, 1000);
  });
  window.addEventListener('online', () => void syncNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
    else if (timer !== undefined) flush();
  });
  // закрытие вкладки обрывает выгрузку — браузер спросит, если последние правки ещё не ушли
  window.addEventListener('beforeunload', (e) => {
    if (sent === edits || state.status === 'off' || !navigator.onLine) return;
    flush();
    e.preventDefault();
  });
  setInterval(() => void syncNow(), 5 * 60_000);
  void syncNow();
}
