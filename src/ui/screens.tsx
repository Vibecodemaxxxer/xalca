import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useState } from 'react';
import { alive, db } from '../db/db';
import type { Routine, RoutineLog, Task } from '../db/types';
import { newTask } from '../domain/ops';
import { isDue, streak, upcoming } from '../domain/recurrence';
import { Az } from '../i18n/Az';
import { addDays, today, type Day } from '../lib/date';
import { Empty, Icon, Section } from './common';
import { RoutineSheet, TaskSheet } from './Editors';
import { dayLabel, longDate } from './fmt';
import { RoutineRow, TaskRow } from './Rows';

function useData() {
  const tasks = useLiveQuery(() => db.tasks.filter(alive).toArray(), []) ?? [];
  const routines = useLiveQuery(() => db.routines.filter(alive).toArray(), []) ?? [];
  const logs = useLiveQuery(() => db.routineLogs.filter(alive).toArray(), []) ?? [];
  return { tasks, routines, logs };
}

/** Индекс отметок рутин: routineId → день → отметка. */
function useLogIndex(logs: RoutineLog[]) {
  return useMemo(() => {
    const m = new Map<string, Map<Day, RoutineLog>>();
    for (const l of logs) {
      if (!m.has(l.routineId)) m.set(l.routineId, new Map());
      m.get(l.routineId)!.set(l.date, l);
    }
    return m;
  }, [logs]);
}

function doneDays(idx: Map<Day, RoutineLog> | undefined): Set<Day> {
  const s = new Set<Day>();
  idx?.forEach((l, d) => l.done && s.add(d));
  return s;
}

function lastDoneBefore(done: Set<Day>, day: Day): Day | undefined {
  let best: Day | undefined;
  for (const d of done) if (d < day && (!best || d > best)) best = d;
  return best;
}

const byTime = (a: { time?: string | null; order: number }, b: { time?: string | null; order: number }) =>
  (a.time || '99').localeCompare(b.time || '99') || a.order - b.order;

type Editing = { kind: 'task'; task?: Task; defaults?: Partial<Task> } | { kind: 'routine'; routine?: Routine } | null;

function Editor({ editing, close }: { editing: Editing; close: () => void }) {
  if (!editing) return null;
  if (editing.kind === 'task') return <TaskSheet task={editing.task} defaults={editing.defaults} onClose={close} />;
  return <RoutineSheet routine={editing.routine} onClose={close} />;
}

function QuickAdd({ date }: { date?: Day }) {
  const [text, setText] = useState('');
  const add = async () => {
    if (!text.trim()) return;
    await newTask({ title: text.trim(), date: date ?? null });
    setText('');
  };
  return (
    <form className="quick" onSubmit={(e) => (e.preventDefault(), add())}>
      <input type="text" placeholder="+ Yeni tapşırıq…" value={text} onChange={(e) => setText(e.target.value)} />
    </form>
  );
}

// ---------------- Bu gün ----------------

export function TodayScreen() {
  const { tasks, routines, logs } = useData();
  const idx = useLogIndex(logs);
  const [editing, setEditing] = useState<Editing>(null);
  const t = today();
  const head = longDate(t);

  const overdue = tasks.filter((x) => x.status !== 'done' && x.date && x.date < t).sort((a, b) => a.date!.localeCompare(b.date!));
  const todays = tasks.filter((x) => x.date === t && x.status !== 'done').sort(byTime);
  const doneToday = tasks.filter((x) => x.status === 'done' && x.completedAt && new Date(x.completedAt).toDateString() === new Date().toDateString());

  const dueRoutines = routines
    .filter((r) => r.active)
    .map((r) => {
      const days = doneDays(idx.get(r.id));
      return { r, log: idx.get(r.id)?.get(t), due: isDue(r.recurrence, t, lastDoneBefore(days, t)), streak: streak(r.recurrence, days, t) };
    })
    .filter((x) => x.due || x.log?.done)
    .sort((a, b) => Number(!!a.log?.done) - Number(!!b.log?.done) || byTime(a.r, b.r));

  const nothing = !overdue.length && !todays.length && !dueRoutines.length && !doneToday.length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <Az>Bu gün</Az>
          </h1>
          <div className="sub">
            <Az ru={head.ru}>{head.az}</Az>
          </div>
        </div>
      </div>
      <QuickAdd date={t} />

      {nothing && <Empty az="Bu gün heç nə yoxdur" />}

      {overdue.length > 0 && (
        <Section title="Gecikmiş" count={overdue.length} className="overdue">
          <div className="list">
            {overdue.map((x) => <TaskRow key={x.id} task={x} onOpen={() => setEditing({ kind: 'task', task: x })} />)}
          </div>
        </Section>
      )}

      {dueRoutines.length > 0 && (
        <Section title="Vərdişlər" count={dueRoutines.filter((x) => !x.log?.done).length}>
          <div className="list">
            {dueRoutines.map(({ r, log, streak }) => (
              <RoutineRow key={r.id} routine={r} day={t} log={log} streak={streak} onOpen={() => setEditing({ kind: 'routine', routine: r })} />
            ))}
          </div>
        </Section>
      )}

      {todays.length > 0 && (
        <Section title="Tapşırıqlar" count={todays.length}>
          <div className="list">
            {todays.map((x) => <TaskRow key={x.id} task={x} showDate={false} onOpen={() => setEditing({ kind: 'task', task: x })} />)}
          </div>
        </Section>
      )}

      {doneToday.length > 0 && (
        <Section title="Tamamlandı" count={doneToday.length}>
          <div className="list">
            {doneToday.map((x) => <TaskRow key={x.id} task={x} showDate={false} onOpen={() => setEditing({ kind: 'task', task: x })} />)}
          </div>
        </Section>
      )}

      <button className="fab" aria-label="Новая задача" onClick={() => setEditing({ kind: 'task', defaults: { date: t } })}>
        {Icon.plus}
      </button>
      <Editor editing={editing} close={() => setEditing(null)} />
    </>
  );
}

// ---------------- Vərdişlər ----------------

export function RoutinesScreen() {
  const { routines, logs } = useData();
  const idx = useLogIndex(logs);
  const [editing, setEditing] = useState<Editing>(null);
  const t = today();

  const rows = routines
    .map((r) => {
      const days = doneDays(idx.get(r.id));
      const doneToday = days.has(t);
      const next = upcoming(r.recurrence, doneToday ? addDays(t, 1) : t, 400, lastDoneBefore(days, doneToday ? addDays(t, 1) : t))[0];
      return { r, streak: streak(r.recurrence, days, t), next, log: idx.get(r.id)?.get(t) };
    })
    .sort((a, b) => Number(b.r.active) - Number(a.r.active) || byTime(a.r, b.r));

  const active = rows.filter((x) => x.r.active);
  const paused = rows.filter((x) => !x.r.active);

  const list = (xs: typeof rows) => (
    <div className="list">
      {xs.map(({ r, streak, next, log }) => (
        <div key={r.id}>
          <RoutineRow routine={r} day={t} log={log} streak={streak} onOpen={() => setEditing({ kind: 'routine', routine: r })} />
          {next && next !== t && (
            <div className="hint" style={{ padding: '2px 14px 0' }}>
              <Az>Növbəti</Az>: <Az ru={dayLabel(next).ru}>{dayLabel(next).az}</Az>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>
            <Az>Vərdişlər</Az>
          </h1>
          <div className="sub">рутина и привычки</div>
        </div>
      </div>
      {!rows.length && <Empty az="Yeni vərdiş" ru="Добавь первую привычку кнопкой +" />}
      {active.length > 0 && list(active)}
      {paused.length > 0 && (
        <Section title="Fasilə" count={paused.length}>
          {list(paused)}
        </Section>
      )}
      <button className="fab" aria-label="Новая привычка" onClick={() => setEditing({ kind: 'routine' })}>
        {Icon.plus}
      </button>
      <Editor editing={editing} close={() => setEditing(null)} />
    </>
  );
}

// ---------------- Tapşırıqlar ----------------

export function TasksScreen() {
  const { tasks } = useData();
  const [editing, setEditing] = useState<Editing>(null);
  const [showDone, setShowDone] = useState(false);
  const t = today();
  const tm = addDays(t, 1);

  const open = tasks.filter((x) => x.status !== 'done');
  const groups: { title: string; items: Task[]; cls?: string; showDate?: boolean }[] = [
    { title: 'Gecikmiş', items: open.filter((x) => x.date && x.date < t), cls: 'overdue' },
    { title: 'Bu gün', items: open.filter((x) => x.date === t), showDate: false },
    { title: 'Sabah', items: open.filter((x) => x.date === tm), showDate: false },
    { title: 'Qarşıdakı', items: open.filter((x) => x.date && x.date > tm) },
    { title: 'Tarixsiz', items: open.filter((x) => !x.date).sort((a, b) => b.order - a.order) },
  ];
  for (const g of groups.slice(0, 4)) g.items.sort((a, b) => a.date!.localeCompare(b.date!) || byTime(a, b));
  const done = tasks.filter((x) => x.status === 'done').sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0)).slice(0, 50);

  return (
    <>
      <div className="page-head">
        <h1>
          <Az>Tapşırıqlar</Az>
        </h1>
        <button className="btn ghost" onClick={() => setShowDone(!showDone)}>
          <Az>{showDone ? 'Bağla' : 'Tamamlanmışları göstər'}</Az>
        </button>
      </div>
      <QuickAdd />
      {!open.length && !showDone && <Empty az="Bu gün heç nə yoxdur" ru="Задач нет — добавь первую" />}
      {groups
        .filter((g) => g.items.length)
        .map((g) => (
          <Section key={g.title} title={g.title} count={g.items.length} className={g.cls}>
            <div className="list">
              {g.items.map((x) => <TaskRow key={x.id} task={x} showDate={g.showDate ?? true} onOpen={() => setEditing({ kind: 'task', task: x })} />)}
            </div>
          </Section>
        ))}
      {showDone && (
        <Section title="Tamamlandı" count={done.length}>
          <div className="list">
            {done.map((x) => <TaskRow key={x.id} task={x} onOpen={() => setEditing({ kind: 'task', task: x })} />)}
          </div>
        </Section>
      )}
      <button className="fab" aria-label="Новая задача" onClick={() => setEditing({ kind: 'task' })}>
        {Icon.plus}
      </button>
      <Editor editing={editing} close={() => setEditing(null)} />
    </>
  );
}
