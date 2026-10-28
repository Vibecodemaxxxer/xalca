import type { Routine, RoutineLog } from '../db/types';
import { isScheduled } from '../domain/recurrence';
import { addDays, diffDays, parseDay, type Day } from '../lib/date';
import type { EventDef, EventRun } from './types';

export const runIdOf = (def: EventDef, start: Day) => `${def.id}-${start.slice(0, 4)}`;
export const routineIdOf = (runId: string, key: string) => `ev-${runId}-${key}`;

/** Сколько дней после окончания плашка ещё показывает итог. */
export const RESULT_DAYS = 3;
/** За сколько дней до начала ивент уже виден (можно подключиться заранее). */
export const ANNOUNCE_DAYS = 3;

/** Все проведения ивента, которые надо учитывать на дату today (прошлый и текущий год). */
function datesAround(def: EventDef, today: Day) {
  const y = parseDay(today).getFullYear();
  return [y - 1, y, y + 1].map((yr) => def.dates(yr)).filter((d): d is { start: Day; end: Day } => !!d);
}

/** Прогресс: выполненные дни из всех запланированных за ивент (будущие тоже в «всего»). */
export function runProgress(start: Day, end: Day, routines: Routine[], logs: RoutineLog[]) {
  let total = 0;
  let done = 0;
  const doneSet = new Set(logs.filter((l) => l.done && !l.deletedAt).map((l) => `${l.routineId}:${l.date}`));
  for (const r of routines) {
    const rec = r.recurrence;
    // «после выполнения»: столько раз, сколько помещается интервалов в ивент
    if (rec.kind === 'after') total += Math.floor(diffDays(start, end) / rec.days) + 1;
    for (let d = start; d <= end; d = addDays(d, 1)) {
      if (rec.kind !== 'after' && isScheduled(rec, d)) total++;
      if (doneSet.has(`${r.id}:${d}`)) done++;
    }
  }
  // отметки сверх плана не дают прогресс больше 100%
  return { done: Math.min(done, total), total };
}

export function buildRun(def: EventDef, dates: { start: Day; end: Day }, today: Day, routines: Routine[], logs: RoutineLog[]): EventRun {
  const runId = runIdOf(def, dates.start);
  const own = routines.filter((r) => r.eventId === runId && !r.deletedAt);
  const ids = new Set(own.map((r) => r.id));
  const ownLogs = logs.filter((l) => ids.has(l.routineId));
  const progress = runProgress(dates.start, dates.end, own, ownLogs);
  const status = today < dates.start ? 'upcoming' : today > dates.end ? 'finished' : 'active';
  const ratio = progress.total ? progress.done / progress.total : 0;
  return {
    def,
    runId,
    ...dates,
    status,
    joined: own.length > 0,
    routines: own,
    logs: ownLogs,
    progress,
    // значок — когда цель уже достигнута (в т.ч. досрочно) или по итогам
    earned: own.length > 0 && progress.total > 0 && ratio >= def.goal,
  };
}

/** Ивенты, которые сейчас видны на «Bu gün»: скоро начнутся, идут или только что закончились. */
export function visibleRuns(defs: EventDef[], today: Day, routines: Routine[], logs: RoutineLog[]): EventRun[] {
  const out: EventRun[] = [];
  for (const def of defs) {
    for (const d of datesAround(def, today)) {
      if (today >= addDays(d.start, -ANNOUNCE_DAYS) && today <= addDays(d.end, RESULT_DAYS)) out.push(buildRun(def, d, today, routines, logs));
    }
  }
  return out;
}

/** Все проведения, в которых пользователь участвовал (для значков в профиле). */
export function pastRuns(defs: EventDef[], today: Day, routines: Routine[], logs: RoutineLog[]): EventRun[] {
  const runIds = new Set(routines.map((r) => r.eventId).filter(Boolean) as string[]);
  const out: EventRun[] = [];
  for (const runId of runIds) {
    const def = defs.find((d) => runId.startsWith(`${d.id}-`));
    if (!def) continue;
    const dates = def.dates(Number(runId.slice(def.id.length + 1)));
    if (dates) out.push(buildRun(def, dates, today, routines, logs));
  }
  return out.sort((a, b) => b.start.localeCompare(a.start));
}

/** Найти проведение по runId (для страницы ивента). */
export function findRun(defs: EventDef[], runId: string, today: Day, routines: Routine[], logs: RoutineLog[]): EventRun | undefined {
  const def = defs.find((d) => runId.startsWith(`${d.id}-`));
  if (!def) return undefined;
  const dates = def.dates(Number(runId.slice(def.id.length + 1)));
  return dates ? buildRun(def, dates, today, routines, logs) : undefined;
}
