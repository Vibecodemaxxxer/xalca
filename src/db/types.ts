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

/** Размер задачи — от него зависит награда. */
export type TaskSize = 's' | 'm' | 'l';

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
  /** Нет поля — обычная (m). */
  size?: TaskSize;
  /** Эмодзи перед названием, как в Notion. */
  icon?: string | null;
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
  /** Проект завершён — даёт бонус: половину наград за его задачи. */
  completedAt?: number | null;
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

/** Награда, которую можно «купить» за abbası. */
export interface Reward extends Base {
  title: string;
  price: number;
  /** Одноразовая награда после покупки исчезает из списка. */
  repeatable: boolean;
  order: number;
}

/** Покупка награды. Название и цена копируются, чтобы история не менялась при правке награды. */
export interface Purchase extends Base {
  rewardId: string;
  title: string;
  price: number;
  at: number;
}

/** Сообщение в «Saxlanılanlar» (избранное, как в Telegram). */
export interface Note extends Base {
  text: string;
  /** Хеши картинок (как в описаниях задач). */
  images: string[];
  pinned: boolean;
  /** Куда перенесено при разборе. */
  movedTo?: { kind: 'task' | 'project' | 'routine' | 'projectNote'; id: string; title: string } | null;
  /** Разобрано без переноса («оставить»). */
  reviewed?: boolean;
  /** Когда разобрано (перенесено или оставлено) — для опыта за разбор. */
  processedAt?: number | null;
  /** Когда текст правили (показываем «изм.», как в Telegram). */
  editedAt?: number | null;
}

export type SyncTable = 'tasks' | 'projects' | 'routines' | 'routineLogs' | 'rewards' | 'purchases' | 'notes';
export const SYNC_TABLES: SyncTable[] = ['tasks', 'projects', 'routines', 'routineLogs', 'rewards', 'purchases', 'notes'];
