import { describe, expect, it } from 'vitest';
import { ancestors, childIndex, descendants, projectProgress, subtasksComplete, taskProgress } from './tree';

const t = (id: string, f: Record<string, unknown> = {}) =>
  ({ id, title: id, status: 'todo', metric: { type: 'check' }, order: 0, parentId: null, projectId: 'p', deletedAt: null, ...f }) as any;

describe('tree', () => {
  const tasks = [
    t('a', { metric: { type: 'subtasks' } }),
    t('a1', { parentId: 'a', order: 2, status: 'done' }),
    t('a2', { parentId: 'a', order: 1 }),
    t('a2x', { parentId: 'a2' }),
    t('gone', { parentId: 'a', deletedAt: 5 }),
    t('b', { metric: { type: 'criteria', items: [{ text: 'x', done: true }, { text: 'y', done: false }] } }),
  ];
  const idx = childIndex(tasks);

  it('дети отсортированы, удалённые скрыты', () => {
    expect(idx.get('a')!.map((x) => x.id)).toEqual(['a2', 'a1']);
  });

  it('потомки в глубину', () => {
    expect(descendants('a', idx).map((x) => x.id).sort()).toEqual(['a1', 'a2', 'a2x']);
  });

  it('прогресс по подзадачам и критериям', () => {
    expect(taskProgress(tasks[0], idx)).toEqual({ done: 1, total: 2 });
    expect(taskProgress(tasks[5], idx)).toEqual({ done: 1, total: 2 });
    expect(taskProgress(tasks[1], idx)).toBeNull();
  });

  it('родитель выполнен только когда все дети выполнены и они есть', () => {
    expect(subtasksComplete([])).toBe(false);
    expect(subtasksComplete([t('x', { status: 'done' })])).toBe(true);
    expect(subtasksComplete(idx.get('a')!)).toBe(false);
  });

  it('прогресс проекта не считает удалённые', () => {
    expect(projectProgress('p', tasks)).toEqual({ done: 1, total: 5 });
  });

  it('предки', () => {
    const byId = new Map(tasks.map((x) => [x.id, x]));
    expect(ancestors(byId.get('a2x')!, byId).map((x) => x.id)).toEqual(['a', 'a2']);
  });
});
