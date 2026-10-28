import type { Routine, RoutineLog, Task } from '../db/types';
import { addDays, parseDay, toDay, weekday, type Day } from '../lib/date';
import { isDue, isScheduled, nextAfter } from './recurrence';

/** 42 дня (6 недель с понедельника), покрывающие месяц, в котором лежит day. */
export function monthGrid(day: Day): Day[] {
  const d = parseDay(day);
  const first = toDay(new Date(d.getFullYear(), d.getMonth(), 1));
  const start = addDays(first, -weekday(first));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

/** 7 дней недели (с понедельника), в которую попадает day. */
export function weekDays(day: Day): Day[] {
  const start = addDays(day, -weekday(day));
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

export interface RoutineOnDay {
  routine: Routine;
  log?: RoutineLog;
  done: boolean;
}

export interface DayItems {
  tasks: Task[];
  routines: RoutineOnDay[];
}

/**
 * Что показать в календаре в конкретный день.
 * Задачи — по дате. Привычки: в прошлом — только выполненные, сегодня — все нужные и выполненные,
 * в будущем — по расписанию (для «после выполнения» — ближайший ожидаемый день).
 */
export function itemsByDay(days: Day[], today: Day, tasks: Task[], routines: Routine[], logs: RoutineLog[]): Map<Day, DayItems> {
  const out = new Map<Day, DayItems>(days.map((d) => [d, { tasks: [], routines: [] }]));

  for (const t of tasks) {
    if (t.deletedAt || !t.date) continue;
    out.get(t.date)?.tasks.push(t);
  }

  const logIdx = new Map<string, Map<Day, RoutineLog>>();
  for (const l of logs) {
    if (l.deletedAt) continue;
    if (!logIdx.has(l.routineId)) logIdx.set(l.routineId, new Map());
    logIdx.get(l.routineId)!.set(l.date, l);
  }

  for (const r of routines) {
    if (r.deletedAt) continue;
    const ls = logIdx.get(r.id) ?? new Map<Day, RoutineLog>();
    const doneDays = [...ls.values()].filter((l) => l.done).map((l) => l.date).sort();
    const lastDoneBefore = (d: Day) => {
      let best: Day | undefined;
      for (const x of doneDays) if (x < d) best = x;
      return best;
    };
    // Для «после выполнения» в будущем — один ожидаемый день.
    const nextAfterDay = r.recurrence.kind === 'after' ? nextAfter(r.recurrence, doneDays[doneDays.length - 1]) : undefined;

    for (const d of days) {
      const log = ls.get(d);
      const done = !!log?.done;
      let show = false;
      if (d < today) show = done;
      else if (!r.active) show = done;
      else if (d === today) show = done || isDue(r.recurrence, d, lastDoneBefore(d));
      // просроченная «после выполнения» уже показана сегодня, в будущее не переносим
      else if (r.recurrence.kind === 'after') show = nextAfterDay! > today && d === nextAfterDay;
      else show = isScheduled(r.recurrence, d);
      if (show) out.get(d)!.routines.push({ routine: r, log, done });
    }
  }

  for (const v of out.values()) {
    v.tasks.sort((a, b) => (a.time || '99').localeCompare(b.time || '99') || a.order - b.order);
    v.routines.sort((a, b) => (a.routine.time || '99').localeCompare(b.routine.time || '99'));
  }
  return out;
}
