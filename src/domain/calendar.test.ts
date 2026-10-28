import { describe, expect, it } from 'vitest';
import { itemsByDay, monthGrid, weekDays } from './calendar';

const base = { createdAt: 0, updatedAt: 0, deletedAt: null, _ts: {} };
const routine = (id: string, recurrence: any, f = {}) => ({ ...base, id, title: id, description: '', recurrence, active: true, order: 0, metric: { type: 'check' }, ...f }) as any;
const log = (routineId: string, date: string, done = true) => ({ ...base, id: `${routineId}:${date}`, routineId, date, done }) as any;
const task = (id: string, date: string | null, f = {}) => ({ ...base, id, title: id, date, time: null, order: 0, status: 'todo', ...f }) as any;

describe('calendar', () => {
  it('сетка месяца начинается с понедельника и покрывает месяц', () => {
    const g = monthGrid('2026-10-15');
    expect(g[0]).toBe('2026-09-28'); // пн
    expect(g).toContain('2026-10-01');
    expect(g).toContain('2026-10-31');
    expect(g).toHaveLength(42);
  });

  it('неделя с понедельника', () => {
    expect(weekDays('2026-10-28')).toEqual(['2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29', '2026-10-30', '2026-10-31', '2026-11-01']);
  });

  it('привычки: прошлое — только выполненное, сегодня — нужное, будущее — по расписанию', () => {
    const days = weekDays('2026-10-28');
    const r = routine('r', { kind: 'weekly', interval: 1, weekdays: [0, 2, 4], start: '2026-01-01' }); // пн ср пт
    const m = itemsByDay(days, '2026-10-28', [], [r], [log('r', '2026-10-26')]);
    expect(m.get('2026-10-26')!.routines.map((x) => x.done)).toEqual([true]);
    expect(m.get('2026-10-27')!.routines).toHaveLength(0);
    expect(m.get('2026-10-28')!.routines.map((x) => x.done)).toEqual([false]);
    expect(m.get('2026-10-30')!.routines).toHaveLength(1);
    expect(m.get('2026-10-31')!.routines).toHaveLength(0);
  });

  it('«после выполнения»: в будущем — один ожидаемый день', () => {
    const days = weekDays('2026-10-28');
    const r = routine('w', { kind: 'after', days: 3, start: '2026-01-01' });
    const m = itemsByDay(days, '2026-10-28', [], [r], [log('w', '2026-10-27')]);
    const shown = days.filter((d) => m.get(d)!.routines.length);
    expect(shown).toEqual(['2026-10-27', '2026-10-30']);
  });

  it('задачи по своим датам, без даты — нигде', () => {
    const days = weekDays('2026-10-28');
    const m = itemsByDay(days, '2026-10-28', [task('a', '2026-10-29'), task('b', null), task('c', '2026-10-29', { time: '09:00' })], [], []);
    expect(m.get('2026-10-29')!.tasks.map((t) => t.id)).toEqual(['c', 'a']);
  });
});
