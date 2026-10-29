import { create, db, update, upsert } from '../db/db';
import type { Base, Metric, Note, Project, Purchase, Reward, Routine, RoutineLog, Task, TaskStatus } from '../db/types';
import { noteToTask } from './notes';
import { type Day } from '../lib/date';
import { imageRefs } from '../sync/images';
import type { EventRun } from '../events/types';
import { routineIdOf } from '../events/runtime';
import { tr } from '../i18n/lang';
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

/** Переместить задачу на доске: новый статус и место в колонке. */
export async function moveTask(t: Task, status: TaskStatus, order: number) {
  const done = status === 'done';
  await update<Task>('tasks', t.id, {
    status,
    order,
    completedAt: done ? (t.completedAt ?? Date.now()) : null,
  });
  if (done !== (t.status === 'done')) await propagate(t.parentId);
}

/** Перенести задачу на другой день (время сохраняется). */
export function moveTaskToDay(t: Task, date: Day) {
  return update<Task>('tasks', t.id, { date });
}

/** Подключиться к ивенту: создать его привычки с постоянными id (без дублей между устройствами). */
export async function joinEvent(run: EventRun) {
  for (const er of run.def.routines) {
    await upsert<Routine>('routines', routineIdOf(run.runId, er.key), {
      title: tr(er.title.az, er.title.ru, 'text'),
      description: er.description ?? '',
      recurrence: er.recurrence(run.start, run.end),
      time: er.time ?? null,
      reminder: er.reminder ?? null,
      metric: er.metric ?? { type: 'check' },
      active: true,
      order: Date.now(),
      eventId: run.runId,
    });
  }
}

/** Выключить привычки закончившихся ивентов (история и значки остаются). */
export async function finishEndedEvents(routines: Routine[], runs: EventRun[]) {
  const ended = new Set(runs.filter((r) => r.status === 'finished').map((r) => r.runId));
  for (const r of routines) if (r.eventId && r.active && ended.has(r.eventId)) await update<Routine>('routines', r.id, { active: false });
}

export function newReward(fields: { title: string; price: number; repeatable: boolean }) {
  return create<Reward>('rewards', { ...fields, order: Date.now() });
}

/** Купить награду: запись покупки с копией названия и цены. */
export function buyReward(r: Reward) {
  return create<Purchase>('purchases', { rewardId: r.id, title: r.title, price: r.price, at: Date.now() });
}

// ---------------- избранное ----------------

/** Изменить текст сообщения. */
export const editNote = (n: Note, text: string) => update<Note>('notes', n.id, { text, editedAt: Date.now() });

export function newNote(text: string, images: string[] = []) {
  return create<Note>('notes', { text, images, pinned: false, movedTo: null, reviewed: false, processedAt: null });
}

const markMoved = (n: Note, movedTo: NonNullable<Note['movedTo']>) => update<Note>('notes', n.id, { movedTo, processedAt: n.processedAt ?? Date.now() });

/** Сообщение → задача (вернёт задачу, чтобы сразу открыть её карточку). */
export async function noteToTaskOp(n: Note, projectId: string | null = null) {
  const t = await newTask({ ...noteToTask(n), projectId, images: n.images });
  await markMoved(n, { kind: 'task', id: t.id, title: t.title });
  return t;
}

/** Несколько сообщений → одна задача, каждое сообщение — подзадача. */
export async function notesToTask(notes: Note[], title: string, projectId: string | null = null) {
  const parent = await newTask({ title, projectId, metric: { type: 'subtasks' } });
  for (const n of notes) {
    await newTask({ ...noteToTask(n), parentId: parent.id, images: n.images });
    await markMoved(n, { kind: 'task', id: parent.id, title });
  }
  return parent;
}

/** Сообщение → новый проект. */
export async function noteToProject(n: Note) {
  const { title, description } = noteToTask(n);
  const p = await newProject({ title, description });
  await markMoved(n, { kind: 'project', id: p.id, title });
  return p;
}

/** Дописать сообщение в заметки проекта. */
export async function noteToProjectNotes(n: Note, p: Project) {
  const { title, description } = noteToTask(n);
  const block = [title, description].filter(Boolean).join('\n\n');
  await update<Project>('projects', p.id, { description: p.description.trim() ? `${p.description.trim()}\n\n${block}` : block });
  await markMoved(n, { kind: 'projectNote', id: p.id, title: p.title });
}

export const markNoteMoved = markMoved;

/** «Оставить» при разборе. */
export const keepNote = (n: Note) => update<Note>('notes', n.id, { reviewed: true, processedAt: n.processedAt ?? Date.now() });
