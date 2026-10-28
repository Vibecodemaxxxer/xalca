import { describe, expect, it } from 'vitest';
import { buildRun, pastRuns, routineIdOf, runIdOf, visibleRuns } from './runtime';
import type { EventDef } from './types';

const def: EventDef = {
  id: 'test',
  title: { az: 'Sınaq', ru: 'Тест' },
  intro: { az: '', ru: '' },
  dates: (y) => (y === 2026 ? { start: '2026-10-20', end: '2026-10-29' } : null),
  color: '#000',
  accent: '#fff',
  routines: [{ key: 'a', title: { az: 'A', ru: 'A' }, recurrence: (start) => ({ kind: 'daily', interval: 1, start }) }],
  goal: 0.8,
  badge: { title: { az: 'N', ru: 'N' }, icon: () => null },
};

const base = { createdAt: 0, updatedAt: 0, deletedAt: null, _ts: {} };
const runId = runIdOf(def, '2026-10-20');
const routine = { ...base, id: routineIdOf(runId, 'a'), title: 'A', description: '', recurrence: { kind: 'daily', interval: 1, start: '2026-10-20' }, active: true, order: 0, metric: { type: 'check' }, eventId: runId } as any;
const log = (date: string) => ({ ...base, id: `${routine.id}:${date}`, routineId: routine.id, date, done: true }) as any;

describe('events', () => {
  it('видимость: за 3 дня до начала, во время и 3 дня после', () => {
    expect(visibleRuns([def], '2026-10-16', [], [])).toHaveLength(0);
    expect(visibleRuns([def], '2026-10-17', [], [])[0].status).toBe('upcoming');
    expect(visibleRuns([def], '2026-10-25', [], [])[0].status).toBe('active');
    expect(visibleRuns([def], '2026-11-01', [], [])[0].status).toBe('finished');
    expect(visibleRuns([def], '2026-11-02', [], [])).toHaveLength(0);
  });

  it('участие и прогресс: 10 дней ивента, значок при 80%', () => {
    const logs = ['20', '21', '22', '23', '24', '25', '26'].map((d) => log(`2026-10-${d}`));
    const r = buildRun(def, { start: '2026-10-20', end: '2026-10-29' }, '2026-10-26', [routine], logs);
    expect(r.joined).toBe(true);
    expect(r.progress).toEqual({ done: 7, total: 10 });
    expect(r.earned).toBe(false);
    const r2 = buildRun(def, { start: '2026-10-20', end: '2026-10-29' }, '2026-10-30', [routine], [...logs, log('2026-10-27')]);
    expect(r2.earned).toBe(true);
  });

  it('не участвовал — значка нет; прошлые проведения находятся по привычкам', () => {
    expect(buildRun(def, { start: '2026-10-20', end: '2026-10-29' }, '2026-10-30', [], []).joined).toBe(false);
    const past = pastRuns([def], '2026-12-01', [routine], []);
    expect(past.map((p) => p.runId)).toEqual(['test-2026']);
    expect(past[0].status).toBe('finished');
  });
});
