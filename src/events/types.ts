import type { ComponentType, ReactNode } from 'react';
import type { Metric, Recurrence, Routine, RoutineLog } from '../db/types';
import type { Day } from '../lib/date';

export interface Text {
  az: string;
  ru: string;
}

export interface EventRoutine {
  /** Ключ внутри ивента — из него строится постоянный id привычки (без дублей между устройствами). */
  key: string;
  title: Text;
  recurrence: (start: Day, end: Day) => Recurrence;
  time?: string;
  reminder?: number;
  metric?: Metric;
  description?: string;
}

/**
 * Описание сезонного ивента. Каждый ивент — отдельный файл в src/events/ со своим содержимым;
 * общий каркас даёт плашку, страницу, прогресс и значок.
 */
export interface EventDef {
  id: string;
  title: Text;
  /** Короткое описание для плашки и шапки страницы. */
  intro: Text;
  /** Даты проведения в году (включительно); null — в этом году нет. */
  dates(year: number): { start: Day; end: Day } | null;
  /** Цвета оформления. */
  color: string;
  accent: string;
  routines: EventRoutine[];
  /** Доля выполненного (0…1), нужная для значка. */
  goal: number;
  badge: { title: Text; icon: () => ReactNode };
  /** Собственная часть страницы ивента. */
  Page?: ComponentType<{ run: EventRun }>;
}

export interface EventRun {
  def: EventDef;
  /** `${id}-${год начала}` — он же eventId у привычек ивента. */
  runId: string;
  start: Day;
  end: Day;
  status: 'upcoming' | 'active' | 'finished';
  joined: boolean;
  routines: Routine[];
  logs: RoutineLog[];
  progress: { done: number; total: number };
  earned: boolean;
}
