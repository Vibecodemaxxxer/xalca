import { useLiveQuery } from 'dexie-react-hooks';
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { alive, db } from '../db/db';
import type { Project, Routine, RoutineLog, Task } from '../db/types';
import { childIndex, type ChildIndex } from '../domain/tree';

interface Data {
  tasks: Task[];
  routines: Routine[];
  logs: RoutineLog[];
  projects: Project[];
  byId: Map<string, Task>;
  children: ChildIndex;
  projectById: Map<string, Project>;
}

const Ctx = createContext<Data | null>(null);

/** Все живые данные из локальной базы; обновляются сами при любых изменениях (в т.ч. после синка). */
export function DataProvider({ children }: { children: ReactNode }) {
  const tasks = useLiveQuery(() => db.tasks.filter(alive).toArray(), []);
  const routines = useLiveQuery(() => db.routines.filter(alive).toArray(), []);
  const logs = useLiveQuery(() => db.routineLogs.filter(alive).toArray(), []);
  const projects = useLiveQuery(() => db.projects.filter(alive).toArray(), []);

  const value = useMemo<Data | null>(() => {
    if (!tasks || !routines || !logs || !projects) return null;
    return {
      tasks,
      routines,
      logs,
      projects,
      byId: new Map(tasks.map((t) => [t.id, t])),
      children: childIndex(tasks),
      projectById: new Map(projects.map((p) => [p.id, p])),
    };
  }, [tasks, routines, logs, projects]);

  if (!value) return null;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData(): Data {
  const d = useContext(Ctx);
  if (!d) throw new Error('useData вне DataProvider');
  return d;
}
