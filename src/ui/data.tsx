import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { db } from '../db/db';
import type { Project, Routine, RoutineLog, Task } from '../db/types';
import { childIndex, type ChildIndex } from '../domain/tree';
import { totalXp, xpByDay } from '../domain/xp';
import type { Day } from '../lib/date';

interface Data {
  tasks: Task[];
  routines: Routine[];
  logs: RoutineLog[];
  projects: Project[];
  byId: Map<string, Task>;
  children: ChildIndex;
  projectById: Map<string, Project>;
  /** Опыт по дням и всего — по всей истории, включая удалённое. */
  xp: { byDay: Map<Day, number>; total: number };
}

const Ctx = createContext<Data | null>(null);
const alive = <T extends { deletedAt?: number | null }>(xs: T[]) => xs.filter((x) => !x.deletedAt);

/** Все данные из локальной базы; обновляются сами при любых изменениях (в т.ч. после синка). */
export function DataProvider({ children }: { children: ReactNode }) {
  const allTasks = useLiveQuery(() => db.tasks.toArray(), []);
  const allRoutines = useLiveQuery(() => db.routines.toArray(), []);
  const allLogs = useLiveQuery(() => db.routineLogs.toArray(), []);
  const allProjects = useLiveQuery(() => db.projects.toArray(), []);

  const xp = useMemo(() => {
    if (!allTasks || !allRoutines || !allLogs) return null;
    const byDay = xpByDay(allTasks, allRoutines, allLogs);
    return { byDay, total: totalXp(byDay) };
  }, [allTasks, allRoutines, allLogs]);

  const value = useMemo<Data | null>(() => {
    if (!allTasks || !allRoutines || !allLogs || !allProjects || !xp) return null;
    const tasks = alive(allTasks);
    const projects = alive(allProjects);
    return {
      tasks,
      routines: alive(allRoutines),
      logs: alive(allLogs),
      projects,
      byId: new Map(tasks.map((t) => [t.id, t])),
      children: childIndex(tasks),
      projectById: new Map(projects.map((p) => [p.id, p])),
      xp,
    };
  }, [allTasks, allRoutines, allLogs, allProjects, xp]);

  if (!value) return null;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): Data {
  const d = useContext(Ctx);
  if (!d) throw new Error('useData вне DataProvider');
  return d;
}
