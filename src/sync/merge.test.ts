import { describe, expect, it } from 'vitest';
import { mergeRecord } from './merge';

const rec = (fields: Record<string, unknown>, ts: Record<string, string>) =>
  ({ id: 'x', createdAt: 1, updatedAt: 1, _ts: ts, ...fields }) as any;

describe('mergeRecord', () => {
  it('берёт новую запись, если локальной нет', () => {
    const r = rec({ title: 'a' }, { title: '1' });
    expect(mergeRecord(undefined, r)).toBe(r);
  });

  it('сливает разные поля, изменённые на разных устройствах', () => {
    const local = rec({ title: 'new title', status: 'todo' }, { title: '5', status: '1' });
    const remote = rec({ title: 'old', status: 'done' }, { title: '1', status: '6' });
    const m = mergeRecord(local, remote)!;
    expect(m.title).toBe('new title');
    expect(m.status).toBe('done');
    expect(m._ts).toEqual({ title: '5', status: '6' });
  });

  it('возвращает null, если удалённая версия ничего не добавляет', () => {
    const local = rec({ title: 'a' }, { title: '5' });
    const remote = rec({ title: 'b' }, { title: '3' });
    expect(mergeRecord(local, remote)).toBeNull();
  });

  it('удаление побеждает более раннее редактирование', () => {
    const local = rec({ title: 'edited', deletedAt: null }, { title: '2', deletedAt: '1' });
    const remote = rec({ title: 'x', deletedAt: 99 }, { title: '1', deletedAt: '3' });
    expect(mergeRecord(local, remote)!.deletedAt).toBe(99);
  });

  it('коммутативно: результат не зависит от порядка', () => {
    const a = rec({ t: 'A', s: 1 }, { t: '4', s: '1' });
    const b = rec({ t: 'B', s: 2 }, { t: '2', s: '7' });
    const ab = mergeRecord(a, b)!;
    const ba = mergeRecord(b, a)!;
    expect([ab.t, ab.s]).toEqual([ba.t, ba.s]);
  });
});
