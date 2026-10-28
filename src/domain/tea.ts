// Çay fasiləsi — помодоро: работа, затем перерыв на чай.
// Состояние — только время старта и длительности, поэтому фаза вычисляется в любой момент,
// даже если приложение было закрыто.

export interface TeaState {
  workMin: number;
  breakMin: number;
  startedAt: number;
  /** Чашка за этот подход уже засчитана. */
  counted?: boolean;
}

export type TeaPhase = { phase: 'work' | 'break'; remainingMs: number; fraction: number } | { phase: 'done' };

export function teaPhase(s: TeaState, now: number): TeaPhase {
  const workEnd = s.startedAt + s.workMin * 60_000;
  const breakEnd = workEnd + s.breakMin * 60_000;
  if (now < workEnd) return { phase: 'work', remainingMs: workEnd - now, fraction: (now - s.startedAt) / (workEnd - s.startedAt) };
  if (now < breakEnd) return { phase: 'break', remainingMs: breakEnd - now, fraction: (now - workEnd) / (breakEnd - workEnd) };
  return { phase: 'done' };
}

export const teaEnds = (s: TeaState) => {
  const work = new Date(s.startedAt + s.workMin * 60_000);
  return { work, break: new Date(+work + s.breakMin * 60_000) };
};

export function mmss(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export const TEA_PRESETS: [number, number][] = [
  [25, 5],
  [50, 10],
  [15, 3],
];
