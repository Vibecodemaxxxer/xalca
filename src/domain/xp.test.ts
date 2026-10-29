import { describe, expect, it } from 'vitest';
import { dayStreak, knotLevel, rankFor, RANKS, semeniStage, streaksByDay, totalXp, xpByDay } from './xp';

const base = { createdAt: 0, updatedAt: 0, deletedAt: null, _ts: {} };
const at = (day: string) => new Date(`${day}T12:00:00`).getTime();
const task = (f: Record<string, unknown>) => ({ ...base, id: Math.random().toString(), status: 'done', metric: { type: 'check' }, ...f }) as any;
const routine = (recurrence: any) => ({ ...base, id: 'r', recurrence, active: true, metric: { type: 'check' } }) as any;
const log = (date: string, done = true) => ({ ...base, id: `r:${date}`, routineId: 'r', date, done }) as any;

describe('xp', () => {
  it('задачи: базовые очки и бонусы метрик, только выполненные', () => {
    const m = xpByDay(
      [
        task({ completedAt: at('2026-10-01') }),
        task({ completedAt: at('2026-10-01'), metric: { type: 'number', target: 5, unit: '' } }),
        task({ completedAt: at('2026-10-02'), metric: { type: 'criteria', items: [{}, {}, {}] } }),
        task({ status: 'todo', completedAt: null }),
        task({ completedAt: at('2026-10-02'), deletedAt: 5 }), // удалённая выполненная — XP остаётся
      ],
      [],
      [],
    );
    expect(m.get('2026-10-01')).toBe(10 + 15);
    expect(m.get('2026-10-02')).toBe(16 + 10);
  });

  it('стрик по расписанию: пропуск дня по расписанию обрывает, дни вне расписания не мешают', () => {
    const r = routine({ kind: 'weekly', interval: 1, weekdays: [0, 2, 4], start: '2026-01-01' }); // пн ср пт
    const s = streaksByDay(r, ['2026-10-05', '2026-10-07', '2026-10-09', '2026-10-14']); // пн ср пт, (пн 12 пропущен) ср
    expect([...s.values()]).toEqual([1, 2, 3, 1]);
  });

  it('стрик «после выполнения»', () => {
    const r = routine({ kind: 'after', days: 2, start: '2026-01-01' });
    expect([...streaksByDay(r, ['2026-10-01', '2026-10-03', '2026-10-04', '2026-10-09']).values()]).toEqual([1, 2, 3, 1]);
  });

  it('привычки: 5 очков + бонус за стрик, не больше +5', () => {
    const r = routine({ kind: 'daily', interval: 1, start: '2026-01-01' });
    const days = Array.from({ length: 8 }, (_, i) => `2026-10-0${i + 1}`);
    const m = xpByDay([], [r], days.map((d) => log(d)).concat(log('2026-10-09', false)));
    expect(days.map((d) => m.get(d))).toEqual([5, 6, 7, 8, 9, 10, 10, 10]);
    expect(m.get('2026-10-09')).toBeUndefined();
    expect(totalXp(m)).toBe(65);
  });

  it('сословия', () => {
    expect(rankFor(0).rank.az).toBe('Rəiyyət');
    expect(rankFor(99).toNext).toBe(1);
    expect(rankFor(100).rank.az).toBe('Əkinçi');
    expect(rankFor(450).progress).toBeCloseTo(0.5);
    const top = rankFor(99999);
    expect(top.rank.az).toBe('Şah');
    expect(top.next).toBeUndefined();
    expect(RANKS.every((r, i) => i === 0 || r.xp > RANKS[i - 1].xp)).toBe(true);
  });

  it('ковёр и səməni', () => {
    expect([0, 5, 20, 60, 120].map(knotLevel)).toEqual([0, 1, 2, 3, 4]);
    expect(semeniStage(0, false)).toBe(0);
    expect(semeniStage(0, true)).toBe(-1);
    expect([1, 3, 7, 14].map((s) => semeniStage(s, true))).toEqual([1, 2, 3, 4]);
  });
});

describe('размер задач и бонус проекта', () => {
  it('награда зависит от размера', () => {
    const m = xpByDay(
      [task({ completedAt: at('2026-10-01'), size: 's' }), task({ completedAt: at('2026-10-01') }), task({ completedAt: at('2026-10-01'), size: 'l' })],
      [],
      [],
    );
    expect(m.get('2026-10-01')).toBe(5 + 10 + 25);
  });

  it('завершённый проект даёт половину наград за свои задачи в день завершения', () => {
    const tasks = [
      task({ completedAt: at('2026-10-01'), projectId: 'p', size: 'l' }),
      task({ completedAt: at('2026-10-02'), projectId: 'p' }),
      task({ completedAt: at('2026-10-02'), projectId: 'other' }),
    ];
    const open = xpByDay(tasks, [], [], [{ ...base, id: 'p', completedAt: null } as any]);
    expect(open.get('2026-10-05')).toBeUndefined();
    const done = xpByDay(tasks, [], [], [{ ...base, id: 'p', completedAt: at('2026-10-05') } as any]);
    expect(done.get('2026-10-05')).toBe(Math.floor((25 + 10) / 2));
  });
});

it('серия дней подряд', () => {
  const m = new Map([['2026-10-26', 5], ['2026-10-27', 10], ['2026-10-28', 3]]);
  expect(dayStreak(m, '2026-10-28')).toBe(3);
  expect(dayStreak(m, '2026-10-29')).toBe(3); // сегодня ещё пусто — серия не оборвана
  expect(dayStreak(m, '2026-10-30')).toBe(0);
});
