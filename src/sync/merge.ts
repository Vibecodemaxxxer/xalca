import type { Base } from '../db/types';

const META_FIELDS = new Set(['id', 'createdAt', 'updatedAt', '_ts']);

/**
 * Слияние двух версий записи: для каждого поля берётся значение с более поздней меткой.
 * Возвращает null, если локальная версия уже содержит всё из удалённой.
 */
export function mergeRecord<T extends Base>(local: T | undefined, remote: T): T | null {
  if (!local) return remote;
  const out = { ...local } as unknown as Record<string, unknown>;
  const ts: Record<string, string> = { ...local._ts };
  let changed = false;
  for (const [field, rts] of Object.entries(remote._ts ?? {})) {
    if (META_FIELDS.has(field)) continue;
    const lts = ts[field];
    if (!lts || rts > lts) {
      out[field] = (remote as unknown as Record<string, unknown>)[field];
      ts[field] = rts;
      changed = true;
    }
  }
  if (!changed) return null;
  out._ts = ts;
  out.createdAt = Math.min(local.createdAt, remote.createdAt);
  out.updatedAt = Math.max(local.updatedAt, remote.updatedAt);
  return out as unknown as T;
}

/** Самая поздняя метка в записи. */
export function maxStamp(r: Base): string {
  let m = '';
  for (const v of Object.values(r._ts ?? {})) if (v > m) m = v;
  return m;
}
