import { useState } from 'react';
import { remove, update } from '../db/db';
import type { Metric, Recurrence, Routine, Task } from '../db/types';
import { newRoutine, newTask } from '../domain/ops';
import { Az } from '../i18n/Az';
import { today } from '../lib/date';
import { Field, Sheet } from './common';
import { MetricPicker, RecurrencePicker, ReminderPicker } from './pickers';

export function TaskSheet({ task, defaults, onClose }: { task?: Task; defaults?: Partial<Task>; onClose: () => void }) {
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [date, setDate] = useState(task?.date ?? defaults?.date ?? '');
  const [time, setTime] = useState(task?.time ?? '');
  const [reminder, setReminder] = useState<number | null>(task?.reminder ?? null);
  const [metric, setMetric] = useState<Metric>(task?.metric ?? { type: 'check' });

  const save = async () => {
    if (!title.trim()) return;
    const fields = {
      title: title.trim(),
      description,
      date: date || null,
      time: (date && time) || null,
      reminder: date && time ? reminder : null,
      metric,
    };
    if (task) await update<Task>('tasks', task.id, fields);
    else await newTask(fields);
    onClose();
  };

  return (
    <Sheet title={<Az>{task ? 'Redaktə' : 'Yeni tapşırıq'}</Az>} onClose={onClose}>
      <form onSubmit={(e) => (e.preventDefault(), save())}>
        <Field label="Başlıq">
          <input type="text" autoFocus={!task} value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Təsvir">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <div className="grid2">
          <Field label="Tarix">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Vaxt">
            <input type="time" value={time} disabled={!date} onChange={(e) => setTime(e.target.value)} />
          </Field>
        </div>
        <ReminderPicker value={reminder} onChange={setReminder} hasTime={!!(date && time)} />
        <MetricPicker value={metric} onChange={setMetric} />
        <Actions onClose={onClose} onDelete={task && (() => remove('tasks', task.id).then(onClose))} canSave={!!title.trim()} />
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
        <Field label="Təsvir">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ minHeight: 60 }} />
        </Field>
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

function Actions({ onClose, onDelete, canSave }: { onClose: () => void; onDelete?: () => void; canSave: boolean }) {
  return (
    <div className="actions">
      {onDelete && (
        <button
          type="button"
          className="btn danger ghost"
          onClick={() => confirm('Удалить?') && onDelete()}
        >
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
