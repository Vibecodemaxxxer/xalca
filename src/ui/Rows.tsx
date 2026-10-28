import type { Routine, RoutineLog, Task } from '../db/types';
import { describe } from '../domain/recurrence';
import { logRoutine, logRoutineValue, setTaskDone, setTaskProgress } from '../domain/ops';
import { Az } from '../i18n/Az';
import { today, type Day } from '../lib/date';
import { taskProgress } from '../domain/tree';
import { Bar, Check, Icon, Stepper } from './common';
import { useData } from './data';
import { Semeni } from './Game';
import { dayLabel } from './fmt';

export function TaskRow({ task: t, onOpen, showDate = true, showProject = true }: { task: Task; onOpen: () => void; showDate?: boolean; showProject?: boolean }) {
  const { children, projectById, byId } = useData();
  const done = t.status === 'done';
  const late = !done && !!t.date && t.date < today();
  const num = t.metric.type === 'number' ? t.metric : null;
  const progress = num ? null : taskProgress(t, children);
  const d = t.date ? dayLabel(t.date) : null;
  const project = showProject && t.projectId ? projectById.get(t.projectId) : undefined;
  const parent = showProject && t.parentId ? byId.get(t.parentId) : undefined;
  const hasNote = !!t.description.trim();
  const meta = (d && (showDate || late)) || t.time || t.reminder != null || project || parent || hasNote || (progress && progress.total > 0);
  return (
    <div className={`row${done ? ' done' : ''}`}>
      <Check on={done} onToggle={() => setTaskDone(t, !done)} />
      <div className="body" onClick={onOpen}>
        <div className="title">{t.title}</div>
        {meta ? (
          <div className="meta">
            {project && (
              <span className="chip">
                <i className="pdot" style={{ background: project.color }} />
                {project.title}
              </span>
            )}
            {parent && <span className="chip">↳ {parent.title}</span>}
            {d && (showDate || late) && (
              <span className={late ? 'late' : ''}>
                <Az ru={d.ru}>{d.az}</Az>
              </span>
            )}
            {t.time && <span className="chip">{t.time}</span>}
            {t.reminder != null && <span className="chip ico">{Icon.bell}</span>}
            {progress && progress.total > 0 && (
              <span className="chip">
                {progress.done}/{progress.total}
              </span>
            )}
            {hasNote && <span className="chip ico">{t.images.length ? Icon.image : Icon.note}</span>}
          </div>
        ) : null}
        {num && <Bar cur={num.current ?? 0} target={num.target} />}
        {progress && progress.total > 0 && <Bar cur={progress.done} target={progress.total} />}
      </div>
      {num && <Stepper value={num.current ?? 0} target={num.target} unit={num.unit} onChange={(v) => setTaskProgress(t, v)} />}
    </div>
  );
}

export function RoutineRow({ routine: r, day, log, streak, everDone, onOpen }: { routine: Routine; day: Day; log?: RoutineLog; streak: number; everDone?: boolean; onOpen: () => void }) {
  const done = !!log?.done;
  const num = r.metric.type === 'number' ? r.metric : null;
  const value = log?.value ?? 0;
  return (
    <div className={`row routine${done ? ' done' : ''}`}>
      {!num && <Check on={done} onToggle={() => logRoutine(r, day, !done)} />}
      {num && <Check on={done} onToggle={() => logRoutineValue(r, day, done ? 0 : num.target)} />}
      <div className="body" onClick={onOpen}>
        <div className="title">{r.title}</div>
        <div className="meta">
          {r.time && <span>{r.time}</span>}
          <span>{describe(r.recurrence)}</span>
          {streak > 1 && (
            <span className="streak">
              <Az ru={`${streak} подряд`}>{`× ${streak}`}</Az>
            </span>
          )}
        </div>
        {num && <Bar cur={value} target={num.target} />}
      </div>
      {num && <Stepper value={value} target={num.target} unit={num.unit} onChange={(v) => logRoutineValue(r, day, v)} />}
      {everDone != null && <Semeni streak={streak} everDone={everDone} />}
    </div>
  );
}
