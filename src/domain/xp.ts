import type { Note, Project, Routine, RoutineLog, Task, TaskSize } from '../db/types';
import { NOTE_XP } from './notes';
import { addDays, diffDays, toDay, type Day } from '../lib/date';
import { isScheduled } from './recurrence';

// Опыт (XP) не хранится — он вычисляется из истории. Поэтому не может разъехаться между устройствами.
// Считаем по всем записям, включая удалённые: удаление старой задачи не отнимает заработанное.

export const SIZE_XP: Record<TaskSize, number> = { s: 5, m: 10, l: 25 };
/** Доля от наград за задачи проекта, которую даёт его завершение. */
export const PROJECT_BONUS = 0.5;

export const XP = {
  numberBonus: 5,
  perCriterion: 2,
  routine: 5,
  /** Бонус за стрик: +1 за каждый раз подряд сверх первого, но не больше. */
  streakBonusMax: 5,
};

export function taskXp(t: Task): number {
  let xp = SIZE_XP[t.size ?? 'm'];
  if (t.metric.type === 'number') xp += XP.numberBonus;
  if (t.metric.type === 'criteria') xp += XP.perCriterion * t.metric.items.length;
  return xp;
}

/** Номер выполнения подряд для каждого дня отметки привычки. */
export function streaksByDay(r: Routine, doneDays: Day[]): Map<Day, number> {
  const days = [...new Set(doneDays)].sort();
  const done = new Set(days);
  const out = new Map<Day, number>();
  for (const d of days) {
    let prevStreak = 0;
    if (r.recurrence.kind === 'after') {
      const i = days.indexOf(d);
      if (i > 0 && diffDays(days[i - 1], d) <= r.recurrence.days) prevStreak = out.get(days[i - 1])!;
    } else {
      // предыдущий день по расписанию
      let p = addDays(d, -1);
      for (let guard = 0; guard < 400 && p >= r.recurrence.start && !isScheduled(r.recurrence, p); guard++) p = addDays(p, -1);
      if (done.has(p) && isScheduled(r.recurrence, p)) prevStreak = out.get(p) ?? 0;
    }
    out.set(d, prevStreak + 1);
  }
  return out;
}

/** XP по дням. */
export function xpByDay(tasks: Task[], routines: Routine[], logs: RoutineLog[], projects: Project[] = [], notes: Note[] = []): Map<Day, number> {
  const out = new Map<Day, number>();
  const add = (d: Day, n: number) => out.set(d, (out.get(d) ?? 0) + n);

  for (const t of tasks) {
    if (t.status !== 'done' || !t.completedAt) continue;
    add(toDay(new Date(t.completedAt)), taskXp(t));
  }

  for (const p of projects) {
    if (p.deletedAt || !p.completedAt) continue;
    add(toDay(new Date(p.completedAt)), projectBonus(p.id, tasks));
  }

  // разбор избранного
  for (const n of notes) if (n.processedAt) add(toDay(new Date(n.processedAt)), NOTE_XP);

  const byRoutine = new Map<string, Day[]>();
  for (const l of logs) {
    if (!l.done || l.deletedAt) continue;
    if (!byRoutine.has(l.routineId)) byRoutine.set(l.routineId, []);
    byRoutine.get(l.routineId)!.push(l.date);
  }
  for (const r of routines) {
    const days = byRoutine.get(r.id);
    if (!days) continue;
    for (const [d, streak] of streaksByDay(r, days)) add(d, XP.routine + Math.min(XP.streakBonusMax, streak - 1));
  }
  return out;
}

/** Бонус за завершение проекта: половина наград за его выполненные задачи. */
export function projectBonus(projectId: string, tasks: Task[]): number {
  const sum = tasks.filter((t) => t.projectId === projectId && t.status === 'done' && t.completedAt).reduce((a, t) => a + taskXp(t), 0);
  return Math.floor(sum * PROJECT_BONUS);
}

export const totalXp = (byDay: Map<Day, number>) => [...byDay.values()].reduce((a, b) => a + b, 0);

// ---------------- сословия ----------------

export interface Rank {
  az: string;
  ru: string;
  /** Кто это — для подсказки и экрана профиля. */
  about: string;
  xp: number;
}

export const RANKS: Rank[] = [
  { az: 'Rəiyyət', ru: 'Райят', about: 'Податной крестьянин — с этого начинается путь', xp: 0 },
  { az: 'Əkinçi', ru: 'Земледелец', about: 'Свой надел и свой урожай', xp: 100 },
  { az: 'Usta', ru: 'Мастер', about: 'Ремесленник: ковродел, медник, оружейник', xp: 300 },
  { az: 'Tacir', ru: 'Купец', about: 'Караваны по Шёлковому пути', xp: 600 },
  { az: 'Kəndxuda', ru: 'Кендхуда', about: 'Староста деревни, к нему идут за советом', xp: 1000 },
  { az: 'Darğa', ru: 'Дарга', about: 'Управляет порядком в городе', xp: 1600 },
  { az: 'Bəy', ru: 'Бек', about: 'Знатный владетель', xp: 2400 },
  { az: 'Xan', ru: 'Хан', about: 'Правитель ханства', xp: 3500 },
  { az: 'Vəzir', ru: 'Визирь', about: 'Первый советник шаха', xp: 5000 },
  { az: 'Şah', ru: 'Шах', about: 'Вершина пути', xp: 7000 },
];

export function rankFor(total: number) {
  let i = 0;
  while (i + 1 < RANKS.length && total >= RANKS[i + 1].xp) i++;
  const next = RANKS[i + 1];
  const progress = next ? (total - RANKS[i].xp) / (next.xp - RANKS[i].xp) : 1;
  return { index: i, rank: RANKS[i], next, progress, toNext: next ? next.xp - total : 0 };
}

// ---------------- ковёр ----------------

/** Насыщенность ряда ковра по XP дня: 0 — пропуск («дырка»), 4 — полный узор. */
export function knotLevel(xp: number): 0 | 1 | 2 | 3 | 4 {
  if (xp <= 0) return 0;
  if (xp < 20) return 1;
  if (xp < 45) return 2;
  if (xp < 80) return 3;
  return 4;
}

// ---------------- səməni ----------------

/**
 * Состояние ростка səməni для привычки: 0 — зерно, 1…4 — растёт со стриком, -1 — подвял (стрик прервался).
 */
export function semeniStage(streak: number, everDone: boolean): -1 | 0 | 1 | 2 | 3 | 4 {
  if (streak <= 0) return everDone ? -1 : 0;
  if (streak < 3) return 1;
  if (streak < 7) return 2;
  if (streak < 14) return 3;
  return 4;
}
