import { describe as group, expect, it } from 'vitest';
import { describe, isDue, isScheduled, streak, upcoming } from './recurrence';
import { weekday } from '../lib/date';
import type { Recurrence } from '../db/types';

const list = (r: any, from: string, n: number) => upcoming(r, from, n);

group('recurrence', () => {
  it('weekday: 2026-10-28 — среда', () => {
    expect(weekday('2026-10-28')).toBe(2);
  });

  it('раз в 2 дня от даты', () => {
    const r = { kind: 'daily', interval: 2, start: '2026-10-01' } as Recurrence;
    expect(list(r, '2026-10-28', 6)).toEqual(['2026-10-29', '2026-10-31', '2026-11-02']);
    expect(isScheduled(r, '2026-09-29')).toBe(false); // до старта
  });

  it('вт, чт, сб', () => {
    const r = { kind: 'weekly', interval: 1, weekdays: [1, 3, 5], start: '2026-01-01' } as Recurrence;
    expect(list(r, '2026-10-26', 6)).toEqual(['2026-10-27', '2026-10-29', '2026-10-31']);
    expect(describe(r)).toBe('вт, чт, сб');
  });

  it('каждый второй вторник (через неделю)', () => {
    const r = { kind: 'weekly', interval: 2, weekdays: [1], start: '2026-10-27' } as Recurrence;
    expect(list(r, '2026-10-26', 30)).toEqual(['2026-10-27', '2026-11-10', '2026-11-24']);
  });

  it('31-е число в коротком месяце переносится на последний день', () => {
    const r = { kind: 'monthly', interval: 1, start: '2026-01-31', on: { day: 31 } } as Recurrence;
    expect(list(r, '2026-02-01', 60)).toEqual(['2026-02-28', '2026-03-31']);
  });

  it('последняя пятница месяца', () => {
    const r = { kind: 'monthly', interval: 1, start: '2026-01-01', on: { nth: -1, weekday: 4 } } as Recurrence;
    expect(list(r, '2026-10-01', 31)).toEqual(['2026-10-30']);
    expect(describe(r)).toBe('каждый месяц, последнюю пятницу');
  });

  it('второй вторник месяца', () => {
    const r = { kind: 'monthly', interval: 1, start: '2026-01-01', on: { nth: 2, weekday: 1 } } as Recurrence;
    expect(list(r, '2026-11-01', 29)).toEqual(['2026-11-10']);
  });

  it('через N дней после выполнения: переносится, пока не сделано', () => {
    const r = { kind: 'after', days: 3, start: '2026-10-01' } as Recurrence;
    expect(isDue(r, '2026-10-01')).toBe(true);
    expect(isDue(r, '2026-10-12', '2026-10-10')).toBe(false);
    expect(isDue(r, '2026-10-13', '2026-10-10')).toBe(true);
    expect(isDue(r, '2026-10-20', '2026-10-10')).toBe(true);
    expect(upcoming(r, '2026-10-11', 14, '2026-10-10')).toEqual(['2026-10-13']);
  });

  it('стрик по расписанию: сегодняшний невыполненный день не обрывает', () => {
    const r = { kind: 'weekly', interval: 1, weekdays: [1, 3, 5], start: '2026-01-01' } as Recurrence;
    const done = new Set(['2026-10-20', '2026-10-22', '2026-10-24']);
    expect(streak(r, done, '2026-10-27')).toBe(3); // вт 27-го ещё не сделан
    expect(streak(r, done, '2026-10-30')).toBe(0); // пропущен чт 29-го
  });

  it('стрик режима after', () => {
    const r = { kind: 'after', days: 2, start: '2026-10-01' } as Recurrence;
    const done = new Set(['2026-10-01', '2026-10-03', '2026-10-09', '2026-10-11']);
    expect(streak(r, done, '2026-10-12')).toBe(2);
    expect(streak(r, done, '2026-10-14')).toBe(0);
  });
});

group('describe', () => {
  it('один день недели', () => {
    expect(describe({ kind: 'weekly', interval: 1, weekdays: [2], start: '2026-01-01' })).toBe('каждую среду');
    expect(describe({ kind: 'weekly', interval: 2, weekdays: [1], start: '2026-01-01' })).toBe('каждый 2-й вторник');
    expect(describe({ kind: 'weekly', interval: 2, weekdays: [6], start: '2026-01-01' })).toBe('каждое 2-е воскресенье');
  });
});
