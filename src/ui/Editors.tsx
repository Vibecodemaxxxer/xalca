import { useState } from 'react';
import { remove, update } from '../db/db';
import type { Metric, Project, Recurrence, Routine } from '../db/types';
import { deleteProject, newProject, newRoutine, PROJECT_COLORS } from '../domain/ops';
import { Az } from '../i18n/Az';
import { today } from '../lib/date';
import { Field, Sheet } from './common';
import { MdEditor } from './Markdown';
import { MetricPicker, RecurrencePicker, ReminderPicker } from './pickers';

// Карточка задачи и быстрый ввод — в TaskCard.tsx; реэкспорт для прежних импортов.
export { SubAdd as QuickSub, TaskSheet } from './TaskCard';

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

export function RoutineSheet({ routine, defaults, onCreated, onClose }: { routine?: Routine; defaults?: { title?: string; description?: string }; onCreated?: (r: Routine) => void; onClose: () => void }) {
  const [title, setTitle] = useState(routine?.title ?? defaults?.title ?? '');
  const [description, setDescription] = useState(routine?.description ?? defaults?.description ?? '');
  const [recurrence, setRecurrence] = useState<Recurrence>(routine?.recurrence ?? { kind: 'daily', interval: 1, start: today() });
  const [time, setTime] = useState(routine?.time ?? '');
  const [reminder, setReminder] = useState<number | null>(routine?.reminder ?? null);
  const [metric, setMetric] = useState<Metric>(routine?.metric ?? { type: 'check' });
  const [active, setActive] = useState(routine?.active ?? true);

  const save = async () => {
    if (!title.trim()) return;
    const fields = { title: title.trim(), description, recurrence, time: time || null, reminder: time ? reminder : null, metric, active };
    if (routine) await update<Routine>('routines', routine.id, fields);
    else onCreated?.(await newRoutine(fields));
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
