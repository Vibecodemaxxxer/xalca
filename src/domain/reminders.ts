import type { Routine, RoutineLog, Task } from '../db/types';
import { addDays, at, today, type Day } from '../lib/date';
import { upcoming } from './recurrence';

export interface Reminder {
  /** Целое число — так требует Android. */
  id: number;
  title: string;
  body: string;
  at: Date;
}

export const HORIZON_DAYS = 14;

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return Math.abs(h) % 2_000_000_000;
}

function lead(min: number) {
  return min === 0 ? 'сейчас' : min < 60 ? `через ${min} мин` : `через ${min / 60} ч`;
}

/** Все будущие напоминания на HORIZON_DAYS дней. */
export function computeReminders(tasks: Task[], routines: Routine[], logs: RoutineLog[], now = new Date()): Reminder[] {
  const out: Reminder[] = [];
  const push = (key: string, title: string, body: string, when: Date) => {
    if (when > now) out.push({ id: hash(key), title, body, at: when });
  };

  for (const t of tasks) {
    if (t.deletedAt || t.status === 'done' || !t.date || !t.time || t.reminder == null) continue;
    const due = at(t.date, t.time);
    push(`t:${t.id}:${t.date}:${t.time}`, t.title, `Tapşırıq · ${t.time} (${lead(t.reminder)})`, new Date(due.getTime() - t.reminder * 60_000));
  }

  const done = new Map<string, Set<Day>>();
  for (const l of logs) {
    if (l.deletedAt || !l.done) continue;
    if (!done.has(l.routineId)) done.set(l.routineId, new Set());
    done.get(l.routineId)!.add(l.date);
  }

  const from = today();
  for (const r of routines) {
    if (r.deletedAt || !r.active || !r.time || r.reminder == null) continue;
    const d = done.get(r.id) ?? new Set<Day>();
    const last = [...d].sort().pop();
    for (const day of upcoming(r.recurrence, from, HORIZON_DAYS, last)) {
      if (d.has(day)) continue;
      const due = at(day, r.time);
      push(`r:${r.id}:${day}`, r.title, `Vərdiş · ${r.time} (${lead(r.reminder)})`, new Date(due.getTime() - r.reminder * 60_000));
    }
  }
  return out.sort((a, b) => +a.at - +b.at);
}

export const horizonEnd = () => addDays(today(), HORIZON_DAYS);
