import { useState } from 'react';
import { tr } from '../i18n/lang';
import { remove, update } from '../db/db';
import type { Metric, Project, Recurrence, Routine, Task } from '../db/types';
import { deleteProject, deleteTask, moveToProject, newProject, newRoutine, newTask, PROJECT_COLORS, saveTask, setTaskDone } from '../domain/ops';
import { ancestors, descendants, taskProgress } from '../domain/tree';
import { Az } from '../i18n/Az';
import { today } from '../lib/date';
import { Bar, Check, Field, Sheet } from './common';
import { useData } from './data';
import { MdEditor } from './Markdown';
import { MetricPicker, RecurrencePicker, ReminderPicker } from './pickers';

/**
 * Карточка задачи. Внутри — подзадачи и цепочка родителей; переход к ним сохраняет текущую задачу
 * и открывает выбранную в той же шторке.
 */
export function TaskSheet({ task: initial, defaults, onClose }: { task?: Task; defaults?: Partial<Task>; onClose: () => void }) {
  const [current, setCurrent] = useState<{ task?: Task; defaults?: Partial<Task> }>({ task: initial, defaults });
  // key сбрасывает состояние формы при переходе к другой задаче
  return <TaskForm key={current.task?.id ?? 'new'} task={current.task} defaults={current.defaults} onClose={onClose} onOpen={(t) => setCurrent({ task: t })} />;
}

function TaskForm({ task, defaults, onClose, onOpen }: { task?: Task; defaults?: Partial<Task>; onClose: () => void; onOpen: (t: Task) => void }) {
  const { byId, children, projects } = useData();
  const live = task ? (byId.get(task.id) ?? task) : undefined;
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [date, setDate] = useState(task?.date ?? defaults?.date ?? '');
  const [time, setTime] = useState(task?.time ?? '');
  const [reminder, setReminder] = useState<number | null>(task?.reminder ?? null);
  const [metric, setMetric] = useState<Metric>(task?.metric ?? { type: 'check' });
  const [projectId, setProjectId] = useState<string | null>(task?.projectId ?? defaults?.projectId ?? null);
  const parentId = task?.parentId ?? defaults?.parentId ?? null;

  const chain = live ? ancestors(live, byId) : parentId && byId.get(parentId) ? [...ancestors(byId.get(parentId)!, byId), byId.get(parentId)!] : [];

  const fields = () => ({
    title: title.trim(),
    description,
    date: date || null,
    time: (date && time) || null,
    reminder: date && time ? reminder : null,
    // числовой прогресс мог измениться в списке, пока открыта карточка
    metric: metric.type === 'number' && live?.metric.type === 'number' ? { ...metric, current: live.metric.current } : metric,
  });

  /** Сохранить; возвращает сохранённую задачу (или undefined, если нет названия). */
  const persist = async (): Promise<Task | undefined> => {
    if (!title.trim()) return undefined;
    if (task) {
      await saveTask(task.id, fields());
      if (!parentId && projectId !== (task.projectId ?? null)) await moveToProject(task, projectId);
      return task;
    }
    return newTask({ ...fields(), projectId, parentId });
  };

  const save = async () => {
    if (await persist()) onClose();
  };

  const go = async (t: Task) => {
    await persist();
    onOpen(t);
  };

  const subs = live ? (children.get(live.id) ?? []) : [];
  const subCount = live ? descendants(live.id, children).length : 0;

  return (
    <Sheet title={<Az>{task ? 'Redaktə' : parentId ? 'Alt tapşırıq' : 'Yeni tapşırıq'}</Az>} onClose={onClose}>
      {chain.length > 0 && (
        <div className="crumbs">
          {chain.map((p) => (
            <button type="button" key={p.id} className="crumb" onClick={() => void go(p)}>
              {p.title}
            </button>
          ))}
        </div>
      )}
      <form onSubmit={(e) => (e.preventDefault(), save())}>
        <Field label="Başlıq">
          <input type="text" autoFocus={!task} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="field">
          <span>
            <Az>Təsvir</Az>
          </span>
          <MdEditor value={description} onChange={setDescription} startInPreview={!!task} />
        </div>

        <MetricPicker value={metric} onChange={setMetric} kinds={['check', 'number', 'criteria', 'subtasks']} />

        {live && (
          <div className="field">
            <span>
              <Az>Alt tapşırıqlar</Az> {subs.length > 0 && `· ${subs.filter((s) => s.status === 'done').length}/${subs.length}`}
            </span>
            <div className="list">
              {subs.map((s) => (
                <SubRow key={s.id} task={s} onOpen={() => void go(s)} />
              ))}
            </div>
            <QuickSub parent={live} />
          </div>
        )}

        <div className="grid2">
          <Field label="Tarix">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Vaxt">
            <input type="time" value={time} disabled={!date} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <ReminderPicker value={reminder} onChange={setReminder} hasTime={!!(date && time)} />

        {!parentId && (
          <Field label="Layihə">
            <select value={projectId ?? ''} onChange={(e) => setProjectId(e.target.value || null)}>
              <option value="">{tr('— Layihəsiz', '— Без проекта', 'option')}</option>
              {projects
                .filter((p) => !p.archived || p.id === projectId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
            </select>
          </Field>
        )}

        <Actions
          onClose={onClose}
          onDelete={live && (() => deleteTask(live).then(onClose))}
          deleteText={subCount ? `Удалить задачу и ${subCount} подзадач(и)?` : undefined}
          canSave={!!title.trim()}
        />
      </form>
    </Sheet>
  );
}

function SubRow({ task: t, onOpen }: { task: Task; onOpen: () => void }) {
  const { children } = useData();
  const done = t.status === 'done';
  const p = taskProgress(t, children);
  return (
    <div className={`row sub${done ? ' done' : ''}`}>
      <Check on={done} onToggle={() => setTaskDone(t, !done)} />
      <div className="body" onClick={onOpen}>
        <div className="title">{t.title}</div>
        {p && p.total > 0 && <Bar cur={p.done} target={p.total} />}
      </div>
      {p && p.total > 0 && (
        <span className="hint">
          {p.done}/{p.total}
        </span>
      )}
    </div>
  );
}

/** Быстрое добавление подзадачи (Enter — добавить, поле остаётся для следующей). */
export function QuickSub({ parent, autoFocus, onDone }: { parent: Task; autoFocus?: boolean; onDone?: () => void }) {
  const [text, setText] = useState('');
  const add = async () => {
    if (!text.trim()) return;
    await newTask({ title: text.trim(), parentId: parent.id });
    setText('');
  };
  return (
    <input
      type="text"
      className="quick-sub"
      autoFocus={autoFocus}
      placeholder={tr('+ Alt tapşırıq…', '+ Подзадача…')}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => !text.trim() && onDone?.()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          void add();
        }
        if (e.key === 'Escape') {
          e.stopPropagation();
          onDone?.();
        }
      }}
    />
  );
}

export function ProjectSheet({ project, onClose, onCreated }: { project?: Project; onClose: () => void; onCreated?: (p: Project) => void }) {
  const [title, setTitle] = useState(project?.title ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [color, setColor] = useState(project?.color ?? PROJECT_COLORS[0]);

  const save = async () => {
    if (!title.trim()) return;
    const fields = { title: title.trim(), description, color };
    if (project) await update<Project>('projects', project.id, fields);
    else onCreated?.(await newProject(fields));
    onClose();
  };

  return (
    <Sheet title={<Az>{project ? 'Redaktə' : 'Yeni layihə'}</Az>} onClose={onClose}>
      <form onSubmit={(e) => (e.preventDefault(), save())}>
        <Field label="Başlıq">
          <input type="text" autoFocus={!project} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="field">
          <span>
            <Az>Təsvir</Az>
          </span>
          <MdEditor value={description} onChange={setDescription} startInPreview={!!project} />
        </div>
        <div className="field">
          <span>
            <Az>Rəng</Az>
          </span>
          <div className="seg">
            {PROJECT_COLORS.map((c) => (
              <button type="button" key={c} className={`swatch${c === color ? ' on' : ''}`} style={{ background: c }} onClick={() => setColor(c)} aria-label={c} />
            ))}
          </div>
        </div>
        {project && (
          <div className="field">
            <button
              type="button"
              className="btn"
              onClick={() => update<Project>('projects', project.id, { archived: !project.archived }).then(onClose)}
            >
              <Az>{project.archived ? 'Bərpa et' : 'Arxivlə'}</Az>
            </button>
          </div>
        )}
        <Actions
          onClose={onClose}
          onDelete={project && (() => deleteProject(project).then(onClose))}
          deleteText="Удалить проект? Его задачи останутся — без проекта."
          canSave={!!title.trim()}
        />
      </form>
    </Sheet>
  );
}

export function RoutineSheet({ routine, onClose }: { routine?: Routine; onClose: () => void }) {
  const [title, setTitle] = useState(routine?.title ?? '');
  const [description, setDescription] = useState(routine?.description ?? '');
  const [recurrence, setRecurrence] = useState<Recurrence>(routine?.recurrence ?? { kind: 'daily', interval: 1, start: today() });
  const [time, setTime] = useState(routine?.time ?? '');
  const [reminder, setReminder] = useState<number | null>(routine?.reminder ?? null);
  const [metric, setMetric] = useState<Metric>(routine?.metric ?? { type: 'check' });
  const [active, setActive] = useState(routine?.active ?? true);

  const save = async () => {
    if (!title.trim()) return;
    const fields = { title: title.trim(), description, recurrence, time: time || null, reminder: time ? reminder : null, metric, active };
    if (routine) await update<Routine>('routines', routine.id, fields);
    else await newRoutine(fields);
    onClose();
  };

  return (
    <Sheet title={<Az>{routine ? 'Redaktə' : 'Yeni vərdiş'}</Az>} onClose={onClose}>
      <form onSubmit={(e) => (e.preventDefault(), save())}>
        <Field label="Başlıq">
          <input type="text" autoFocus={!routine} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <div className="field">
          <span>
            <Az>Təsvir</Az>
          </span>
          <MdEditor value={description} onChange={setDescription} startInPreview={!!routine} />
        </div>
        <RecurrencePicker value={recurrence} onChange={setRecurrence} />
        <Field label="Vaxt">
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
        <ReminderPicker value={reminder} onChange={setReminder} hasTime={!!time} />
        <MetricPicker value={metric} onChange={(m) => setMetric(m.type === 'number' ? { ...m, current: undefined } : m)} />
        {routine && (
          <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} />
            <Az>Aktiv</Az>
          </label>
        )}
        <Actions onClose={onClose} onDelete={routine && (() => remove('routines', routine.id).then(onClose))} canSave={!!title.trim()} />
      </form>
    </Sheet>
  );
}

function Actions({ onClose, onDelete, canSave, deleteText }: { onClose: () => void; onDelete?: () => void; canSave: boolean; deleteText?: string }) {
  return (
    <div className="actions">
      {onDelete && (
        <button type="button" className="btn danger ghost" onClick={() => confirm(deleteText ?? 'Удалить?') && onDelete()}>
          <Az>Sil</Az>
        </button>
      )}
      <span className="spacer" />
      <button type="button" className="btn ghost" onClick={onClose}>
        <Az>Ləğv et</Az>
      </button>
      <button type="submit" className="btn primary" disabled={!canSave}>
        <Az>Saxla</Az>
      </button>
    </div>
  );
}
