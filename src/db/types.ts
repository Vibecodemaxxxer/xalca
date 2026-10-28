import type { Day } from '../lib/date';

/** Общие поля всех синхронизируемых записей. */
export interface Base {
  id: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
  /** Метки времени изменения каждого поля (для слияния при синхронизации). */
  _ts: Record<string, string>;
}

export type Metric =
  | { type: 'check' }
  | { type: 'number'; target: number; unit: string; current?: number }
  | { type: 'criteria'; items: { text: string; done: boolean }[] }
  | { type: 'subtasks' };

export type TaskStatus = 'todo' | 'doing' | 'done';

export interface Task extends Base {
  title: string;
  description: string;
  images: string[];
  projectId?: string | null;
  parentId?: string | null;
  status: TaskStatus;
  date?: Day | null;
  time?: string | null;
  /** За сколько минут до time напомнить; null — без напоминания. */
  reminder?: number | null;
  metric: Metric;
  order: number;
  completedAt?: number | null;
}

export interface Project extends Base {
  title: string;
  description: string;
  color: string;
  icon: string;
  archived: boolean;
  metric: Metric;
}

export type Recurrence =
  | { kind: 'daily'; interval: number; start: Day }
  | { kind: 'weekly'; interval: number; weekdays: number[]; start: Day }
  | {
      kind: 'monthly';
      interval: number;
      start: Day;
      /** Число месяца (-1 = последний день) или n-й день недели (nth: -1 = последний). */
      on: { day: number } | { nth: number; weekday: number };
    }
  | { kind: 'after'; days: number; start: Day };

export interface Routine extends Base {
  title: string;
  description: string;
  recurrence: Recurrence;
  time?: string | null;
  reminder?: number | null;
  metric: Metric;
  active: boolean;
  order: number;
  eventId?: string | null;
}

export interface RoutineLog extends Base {
  routineId: string;
  date: Day;
  value?: number | null;
  done: boolean;
}

export type SyncTable = 'tasks' | 'projects' | 'routines' | 'routineLogs';
export const SYNC_TABLES: SyncTable[] = ['tasks', 'projects', 'routines', 'routineLogs'];
