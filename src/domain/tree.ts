import type { Metric, Task } from '../db/types';

export type ChildIndex = Map<string, Task[]>;

/** parentId → дети (живые), отсортированные по order. Корневые задачи — под ключом ''. */
export function childIndex(tasks: Task[]): ChildIndex {
  const m: ChildIndex = new Map();
  for (const t of tasks) {
    if (t.deletedAt) continue;
    const k = t.parentId ?? '';
    if (!m.has(k)) m.set(k, []);
    m.get(k)!.push(t);
  }
  for (const list of m.values()) list.sort((a, b) => a.order - b.order);
  return m;
}

export const isDone = (t: Task) => t.status === 'done';

/** Все потомки задачи (в глубину). */
export function descendants(id: string, idx: ChildIndex): Task[] {
  const out: Task[] = [];
  const walk = (pid: string) => {
    for (const c of idx.get(pid) ?? []) {
      out.push(c);
      walk(c.id);
    }
  };
  walk(id);
  return out;
}

export interface Progress {
  done: number;
  total: number;
}

/** Прогресс задачи по её метрике (null — для простой галочки). */
export function taskProgress(t: Task, idx: ChildIndex): Progress | null {
  return metricProgress(t.metric, idx.get(t.id) ?? []);
}

export function metricProgress(m: Metric, children: Task[]): Progress | null {
  switch (m.type) {
    case 'number':
      return { done: m.current ?? 0, total: m.target };
    case 'criteria':
      return { done: m.items.filter((i) => i.done).length, total: m.items.length };
    case 'subtasks':
      return { done: children.filter(isDone).length, total: children.length };
    default:
      return null;
  }
}

/** Должна ли задача с метрикой «по подзадачам» считаться выполненной. */
export function subtasksComplete(children: Task[]): boolean {
  return children.length > 0 && children.every(isDone);
}

/** Прогресс проекта: выполненные задачи из всех задач проекта. */
export function projectProgress(projectId: string, tasks: Task[]): Progress {
  const list = tasks.filter((t) => !t.deletedAt && t.projectId === projectId);
  return { done: list.filter(isDone).length, total: list.length };
}

/** Цепочка предков от корня к родителю задачи. */
export function ancestors(t: Task, byId: Map<string, Task>): Task[] {
  const out: Task[] = [];
  let p = t.parentId ? byId.get(t.parentId) : undefined;
  for (let guard = 0; p && guard < 100; guard++) {
    out.unshift(p);
    p = p.parentId ? byId.get(p.parentId) : undefined;
  }
  return out;
}
