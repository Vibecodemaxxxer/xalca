import { expect, it } from 'vitest';
import { mmss, teaEnds, teaPhase } from './tea';

it('фазы таймера чая', () => {
  const s = { workMin: 25, breakMin: 5, startedAt: 0 };
  expect(teaPhase(s, 0)).toEqual({ phase: 'work', remainingMs: 25 * 60_000, fraction: 0 });
  const mid = teaPhase(s, 12.5 * 60_000);
  expect(mid.phase === 'work' && mid.fraction).toBeCloseTo(0.5);
  const br = teaPhase(s, 26 * 60_000);
  expect(br.phase).toBe('break');
  expect(br.phase === 'break' && br.remainingMs).toBe(4 * 60_000);
  expect(teaPhase(s, 30 * 60_000)).toEqual({ phase: 'done' });
  expect(+teaEnds(s).break).toBe(30 * 60_000);
  expect(mmss(61_000)).toBe('1:01');
  expect(mmss(25 * 60_000)).toBe('25:00');
  expect(mmss(400)).toBe('0:01');
});
