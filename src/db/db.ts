import Dexie, { type Table } from 'dexie';
import type { Base, Project, Routine, RoutineLog, SyncTable, Task } from './types';
import { setNode, stamp } from './hlc';

class XalcaDB extends Dexie {
  tasks!: Table<Task, string>;
  projects!: Table<Project, string>;
  routines!: Table<Routine, string>;
  routineLogs!: Table<RoutineLog, string>;
  /** Локальные настройки устройства, не синхронизируются. */
  meta!: Table<{ key: string; value: unknown }, string>;

  constructor() {
    super('xalca');
    this.version(1).stores({
      tasks: 'id, date, projectId, parentId, status, updatedAt',
      projects: 'id, updatedAt',
      routines: 'id, updatedAt',
      routineLogs: 'id, routineId, date, updatedAt',
      meta: 'key',
    });
  }
}

export const db = new XalcaDB();

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown) {
  await db.meta.put({ key, value });
}

export async function initDevice(): Promise<string> {
  let id = await getMeta<string>('deviceId');
  if (!id) {
    id = crypto.randomUUID().slice(0, 8);
    await setMeta('deviceId', id);
  }
  setNode(id);
  return id;
}

// ---- изменение данных: всегда через эти функции, чтобы проставлялись метки для синка ----

type Changed = () => void;
const listeners = new Set<Changed>();
/** Подписка на локальные изменения (синк запускается с задержкой после них). */
export function onLocalChange(fn: Changed) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const notify = () => listeners.forEach((fn) => fn());

type Data<T> = Omit<T, keyof Base> & Partial<Pick<Base, 'id'>>;

function stampAll(obj: object): Record<string, string> {
  const ts: Record<string, string> = {};
  for (const k of Object.keys(obj)) ts[k] = stamp();
  return ts;
}

export async function create<T extends Base>(table: SyncTable, data: Data<T>): Promise<T> {
  const now = Date.now();
  const { id, ...fields } = data as Data<T> & { id?: string };
  const rec = {
    ...fields,
    id: id ?? crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  } as unknown as T;
  rec._ts = stampAll({ ...fields, deletedAt: null });
  await (db[table] as unknown as Table<T, string>).put(rec);
  notify();
  return rec;
}

export async function update<T extends Base>(table: SyncTable, id: string, patch: Partial<Omit<T, keyof Base>> | { deletedAt: number | null }) {
  const t = db[table] as unknown as Table<T, string>;
  await db.transaction('rw', t, async () => {
    const cur = await t.get(id);
    if (!cur) return;
    const ts = { ...cur._ts, ...stampAll(patch) };
    await t.put({ ...cur, ...patch, _ts: ts, updatedAt: Date.now() });
  });
  notify();
}

export function remove(table: SyncTable, id: string) {
  return update(table, id, { deletedAt: Date.now() });
}

/** Создать или обновить запись с заранее известным id (например, отметка рутины за день). */
export async function upsert<T extends Base>(table: SyncTable, id: string, data: Data<T>) {
  const cur = await db[table].get(id);
  if (cur) await update<T>(table, id, { ...(data as object), deletedAt: null } as Partial<T>);
  else await create<T>(table, { ...data, id });
}

export const alive = <T extends Base>(r: T) => !r.deletedAt;
