import { create, db, update, upsert } from '../db/db';
import type { Base, Metric, Project, Routine, RoutineLog, Task } from '../db/types';
import { type Day } from '../lib/date';
import { imageRefs } from '../sync/images';
import { childIndex, descendants, subtasksComplete } from './tree';

export const logId = (routineId: string, day: Day) => `${routineId}:${day}`;

const liveChildren = (parentId: string) =>
  db.tasks.where('parentId').equals(parentId).filter((t) => !t.deletedAt).toArray();

/**
 * Пересчитать предков с метрикой «по подзадачам»: родитель выполнен, когда выполнены все дети.
 * Поднимается вверх, пока статус меняется.
 */
async function propagate(parentId: string | null | undefined) {
  for (let guard = 0; parentId && guard < 100; guard++) {
    const p = await db.tasks.get(parentId);
    if (!p || p.deletedAt || p.metric.type !== 'subtasks') return;
    const done = subtasksComplete(await liveChildren(p.id));
    if (done === (p.status === 'done')) return;
    await update<Task>('tasks', p.id, { status: done ? 'done' : 'todo', completedAt: done ? Date.now() : null });
    parentId = p.parentId;
  }
}

export async function newTask(fields: Partial<Task> & { title: string }) {
  let projectId = fields.projectId ?? null;
  if (fields.parentId) projectId = (await db.tasks.get(fields.parentId))?.projectId ?? projectId;
  const t = await create<Task>('tasks', {
    description: '',
    images: [],
    status: 'todo',
    metric: { type: 'check' },
    order: Date.now(),
    date: null,
    time: null,
    reminder: null,
    parentId: null,
    completedAt: null,
    ...fields,
    projectId,
  });
  await propagate(t.parentId);
  return t;
}

export async function saveTask(id: string, fields: Partial<Omit<Task, keyof Base>>) {
  if (fields.description != null) fields.images = imageRefs(fields.description);
  // Смена метрики может сразу сделать задачу выполненной (или нет).
  if (fields.metric) {
    const done = await metricDone(id, fields.metric);
    if (done != null) Object.assign(fields, { status: done ? 'done' : 'todo', completedAt: done ? Date.now() : null });
  }
  await update<Task>('tasks', id, fields);
  const t = await db.tasks.get(id);
  await propagate(t?.parentId);
}

async function metricDone(id: string, m: Metric): Promise<boolean | null> {
  if (m.type === 'number') return (m.current ?? 0) >= m.target;
  if (m.type === 'criteria') return m.items.length > 0 && m.items.every((i) => i.done);
  if (m.type === 'subtasks') return subtasksComplete(await liveChildren(id));
  return null;
}

export async function setTaskDone(t: Task, done: boolean) {
  await update<Task>('tasks', t.id, { status: done ? 'done' : 'todo', completedAt: done ? Date.now() : null });
  await propagate(t.parentId);
}

/** Прогресс числовой метрики; при достижении цели задача выполняется автоматически. */
export async function setTaskProgress(t: Task, current: number) {
  if (t.metric.type !== 'number') return;
  const metric: Metric = { ...t.metric, current: Math.max(0, current) };
  const done = metric.current! >= t.metric.target;
  await update<Task>('tasks', t.id, {
    metric,
    status: done ? 'done' : t.status === 'done' ? 'todo' : t.status,
    completedAt: done ? (t.completedAt ?? Date.now()) : null,
  });
  await propagate(t.parentId);
}

/** Отметить критерий; когда отмечены все — задача выполнена. */
export function toggleCriterion(t: Task, i: number) {
  if (t.metric.type !== 'criteria') return;
  const items = t.metric.items.map((it, j) => (j === i ? { ...it, done: !it.done } : it));
  return saveTask(t.id, { metric: { type: 'criteria', items } });
}

/** Удалить задачу вместе со всеми подзадачами. */
export async function deleteTask(t: Task) {
  const all = await db.tasks.toArray();
  const now = Date.now();
  for (const x of [t, ...descendants(t.id, childIndex(all))]) await update<Task>('tasks', x.id, { deletedAt: now });
  await propagate(t.parentId);
}

/** Перенести задачу (корневую) со всей веткой в другой проект. */
export async function moveToProject(t: Task, projectId: string | null) {
  const all = await db.tasks.toArray();
  for (const x of [t, ...descendants(t.id, childIndex(all))]) await update<Task>('tasks', x.id, { projectId });
}

export function newProject(fields: Partial<Project> & { title: string }) {
  return create<Project>('projects', { description: '', color: PROJECT_COLORS[0], icon: '', archived: false, metric: { type: 'subtasks' }, ...fields });
}

export const PROJECT_COLORS = ['#7a1f2b', '#1e3a5f', '#c8902e', '#3f6b4a', '#6b3f7a', '#2f7a78'];

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

/** Удалить проект; его задачи остаются, но без проекта. */
export async function deleteProject(p: Project) {
  const tasks = await db.tasks.where('projectId').equals(p.id).toArray();
  for (const t of tasks) await update<Task>('tasks', t.id, { projectId: null });
  await update<Project>('projects', p.id, { deletedAt: Date.now() });
}
