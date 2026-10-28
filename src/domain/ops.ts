import { create, update, upsert } from '../db/db';
import type { Base, Metric, Routine, RoutineLog, Task } from '../db/types';
import { today, type Day } from '../lib/date';

export const logId = (routineId: string, day: Day) => `${routineId}:${day}`;

export function newTask(fields: Partial<Task> & { title: string }) {
  return create<Task>('tasks', {
    description: '',
    images: [],
    status: 'todo',
    metric: { type: 'check' },
    order: Date.now(),
    date: null,
    time: null,
    reminder: null,
    projectId: null,
    parentId: null,
    completedAt: null,
    ...fields,
  });
}

export function setTaskDone(t: Task, done: boolean) {
  return update<Task>('tasks', t.id, { status: done ? 'done' : 'todo', completedAt: done ? Date.now() : null });
}

/** Прогресс числовой метрики; при достижении цели задача выполняется автоматически. */
export function setTaskProgress(t: Task, current: number) {
  if (t.metric.type !== 'number') return;
  const metric: Metric = { ...t.metric, current: Math.max(0, current) };
  const done = metric.current! >= t.metric.target;
  return update<Task>('tasks', t.id, {
    metric,
    status: done ? 'done' : t.status === 'done' ? 'todo' : t.status,
    completedAt: done ? (t.completedAt ?? Date.now()) : null,
  });
}

export function newRoutine(fields: Omit<Routine, keyof Base | 'order' | 'active' | 'eventId'> & Partial<Pick<Routine, 'order' | 'active' | 'eventId'>>) {
  return create<Routine>('routines', { active: true, order: Date.now(), eventId: null, ...fields });
}

export function logRoutine(r: Routine, day: Day, done: boolean, value?: number) {
  return upsert<RoutineLog>('routineLogs', logId(r.id, day), { routineId: r.id, date: day, done, value: value ?? null });
}

/** Отметка числовой рутины: выполнена, когда значение достигло цели. */
export function logRoutineValue(r: Routine, day: Day, value: number) {
  const target = r.metric.type === 'number' ? r.metric.target : 1;
  return logRoutine(r, day, value >= target, Math.max(0, value));
}

export function metricProgress(m: Metric, value?: number | null): { cur: number; target: number } | null {
  if (m.type !== 'number') return null;
  return { cur: value ?? m.current ?? 0, target: m.target };
}

export const isToday = (d?: Day | null) => d === today();
