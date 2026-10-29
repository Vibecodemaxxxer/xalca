import { useMemo, useState } from 'react';
import { tr } from '../i18n/lang';
import type { Recurrence, Routine, Task } from '../db/types';
import { itemsByDay, monthGrid, weekDays, type DayItems } from '../domain/calendar';
import { moveTaskToDay } from '../domain/ops';
import { Az } from '../i18n/Az';
import { parseDay, toDay, today, type Day } from '../lib/date';
import { Icon, Section } from './common';
import { QuickInput } from './TaskCard';
import { useData } from './data';
import { RoutineSheet, TaskSheet } from './Editors';
import { AZ_MONTHS, AZ_WD_SHORT, dayLabel, RU_MONTHS_NOM, RU_WD_SHORT } from './fmt';
import { RoutineRow, TaskRow } from './Rows';

type Mode = 'month' | 'week';
const MODE_KEY = 'xalca.calMode';

function loadMode(): Mode {
  try {
    return localStorage.getItem(MODE_KEY) === 'week' ? 'week' : 'month';
  } catch {
    return 'month';
  }
}

function shift(day: Day, mode: Mode, dir: number): Day {
  const d = parseDay(day);
  if (mode === 'week') d.setDate(d.getDate() + 7 * dir);
  else d.setMonth(d.getMonth() + dir, 1);
  return toDay(d);
}

const cap = (s: string) => s[0].toUpperCase() + s.slice(1);

export function CalendarView() {
  const { tasks, routines, logs, projectById } = useData();
  const [mode, setModeState] = useState<Mode>(loadMode);
  const [anchor, setAnchor] = useState(today());
  const [sel, setSel] = useState(today());
  const [editing, setEditing] = useState<{ task?: Task; routine?: Routine; date?: Day } | null>(null);
  const [dragOver, setDragOver] = useState<Day | null>(null);
  const t = today();

  const setMode = (m: Mode) => {
    setModeState(m);
    setAnchor(sel);
    try {
      localStorage.setItem(MODE_KEY, m);
    } catch {
      /* не запоминаем */
    }
  };

  const days = mode === 'month' ? monthGrid(anchor) : weekDays(anchor);
  // Выбранный день тоже нужен в индексе, даже если он вне видимой сетки.
  const items = useMemo(() => itemsByDay(days.includes(sel) ? days : [...days, sel], t, tasks, routines, logs), [days.join(), sel, t, tasks, routines, logs]);
  const month = parseDay(anchor).getMonth();
  const a = parseDay(anchor);

  const title =
    mode === 'month'
      ? { az: `${cap(AZ_MONTHS[month])} ${a.getFullYear()}`, ru: `${RU_MONTHS_NOM[month]} ${a.getFullYear()}` }
      : { az: `${dayLabel(days[0]).az} – ${dayLabel(days[6]).az}`, ru: `${dayLabel(days[0]).ru} – ${dayLabel(days[6]).ru}` };


  const selItems = items.get(sel) ?? { tasks: [], routines: [] };
  const sl = dayLabel(sel);

  return (
    <>
      <div className="cal-head">
        <div className="cal-nav">
          <button className="btn ghost" onClick={() => setAnchor(shift(anchor, mode, -1))} aria-label="Назад">
            <span className="ico">{Icon.back}</span>
          </button>
          <span className="cal-title">
            <Az ru={title.ru}>{title.az}</Az>
          </span>
          <button className="btn ghost" onClick={() => setAnchor(shift(anchor, mode, 1))} aria-label="Вперёд">
            <span className="ico">{Icon.chevron}</span>
          </button>
        </div>
        <div className="cal-tools">
          <button
            className="btn ghost"
            onClick={() => {
              setAnchor(t);
              setSel(t);
            }}
          >
            <Az>Bu gün</Az>
          </button>
          <div className="seg">
            <button className={mode === 'month' ? 'on' : ''} onClick={() => setMode('month')}>
              <Az>Ay</Az>
            </button>
            <button className={mode === 'week' ? 'on' : ''} onClick={() => setMode('week')}>
              <Az>Həftə</Az>
            </button>
          </div>
        </div>
      </div>

      <div className={`cal cal-${mode}`}>
        {AZ_WD_SHORT.map((wd, i) => (
          <div key={wd} className="cal-wd">
            <Az ru={RU_WD_SHORT[i]}>{wd}</Az>
          </div>
        ))}
        {days.map((d) => (
          <DayCell
            key={d}
            day={d}
            items={items.get(d)!}
            mode={mode}
            outside={mode === 'month' && parseDay(d).getMonth() !== month}
            isToday={d === t}
            selected={d === sel}
            dragOver={dragOver === d}
            onSelect={() => setSel(d)}
            onOpenTask={(task) => setEditing({ task })}
            onDragOver={(on) => setDragOver(on ? d : null)}
            onDropTask={(id) => {
              setDragOver(null);
              const task = tasks.find((x) => x.id === id);
              if (task && task.date !== d) void moveTaskToDay(task, d);
            }}
            projectColor={(task) => (task.projectId ? projectById.get(task.projectId)?.color : undefined)}
          />
        ))}
      </div>

      <Section title={sl.az} className="cal-agenda">
        <QuickInput key={sel} defaults={{ date: sel }} placeholder={tr(`Yeni tapşırıq — ${sl.az}`, `Новая задача — ${sl.ru.toLowerCase()}`)} />
        <div className="list">
          {selItems.routines.map(({ routine: r, log }) =>
            sel <= t ? (
              <RoutineRow key={r.id} routine={r} day={sel} log={log} streak={0} onOpen={() => setEditing({ routine: r })} />
            ) : (
              <div key={r.id} className="row routine planned" onClick={() => setEditing({ routine: r })}>
                <span className="plan-mark" />
                <div className="body">
                  <div className="title">{r.title}</div>
                  {r.time && <div className="meta">{r.time}</div>}
                </div>
              </div>
            ),
          )}
          {selItems.tasks.map((x) => (
            <TaskRow key={x.id} task={x} showDate={false} onOpen={() => setEditing({ task: x })} />
          ))}
        </div>
        {!selItems.routines.length && !selItems.tasks.length && <p className="hint">Ничего не запланировано</p>}
      </Section>

      {editing?.task && <TaskSheet task={editing.task} onClose={() => setEditing(null)} />}
      {editing?.routine && <RoutineSheet routine={editing.routine} onClose={() => setEditing(null)} />}
    </>
  );
}

function DayCell(p: {
  day: Day;
  items: DayItems;
  mode: Mode;
  outside: boolean;
  isToday: boolean;
  selected: boolean;
  dragOver: boolean;
  onSelect: () => void;
  onOpenTask: (t: Task) => void;
  onDragOver: (on: boolean) => void;
  onDropTask: (id: string) => void;
  projectColor: (t: Task) => string | undefined;
}) {
  const { tasks, routines } = p.items;
  const limit = p.mode === 'week' ? 12 : 3;
  // В клетках месяца ежедневные привычки не показываем — они в каждом дне и только забивают сетку.
  const shown = p.mode === 'month' ? routines.filter((r) => !everyDay(r.routine.recurrence)) : routines;
  // Сначала задачи: при нехватке места важнее они.
  const chips = [
    ...tasks.map((t) => ({ key: t.id, title: t.icon ? `${t.icon} ${t.title}` : t.title, done: t.status === 'done', routine: false as const, task: t, color: p.projectColor(t) })),
    ...shown.map((r) => ({ key: r.routine.id, title: r.routine.title, done: r.done, routine: true as const, task: undefined, color: undefined })),
  ];
  const cls = ['cal-cell', p.outside && 'outside', p.isToday && 'today', p.selected && 'sel', p.dragOver && 'drop'].filter(Boolean).join(' ');
  const d = parseDay(p.day);

  return (
    <div
      className={cls}
      onClick={p.onSelect}
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes('text/x-task')) {
          e.preventDefault();
          p.onDragOver(true);
        }
      }}
      onDragLeave={() => p.onDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        const id = e.dataTransfer.getData('text/x-task');
        if (id) p.onDropTask(id);
      }}
    >
      <div className="cal-num">
        {p.mode === 'week' && <span className="cal-wd-inline">{AZ_WD_SHORT[(d.getDay() + 6) % 7]} </span>}
        {d.getDate()}
      </div>
      <div className="cal-chips">
        {chips.slice(0, limit).map((c) => (
          <div
            key={c.key}
            className={`cal-chip${c.routine ? ' r' : ''}${c.done ? ' done' : ''}`}
            style={c.color ? { borderLeftColor: c.color } : undefined}
            draggable={!!c.task}
            onDragStart={(e) => c.task && e.dataTransfer.setData('text/x-task', c.task.id)}
            onClick={(e) => {
              if (!c.task) return;
              e.stopPropagation();
              p.onSelect();
              p.onOpenTask(c.task);
            }}
          >
            {c.title}
          </div>
        ))}
        {chips.length > limit && <div className="cal-more">+{chips.length - limit}</div>}
      </div>
      <div className="cal-dots">
        {chips.slice(0, 5).map((c) => (
          <i key={c.key} className={`${c.routine ? 'r' : ''}${c.done ? ' done' : ''}`} />
        ))}
      </div>
    </div>
  );
}

function everyDay(r: Recurrence): boolean {
  return (r.kind === 'daily' && r.interval === 1) || (r.kind === 'weekly' && r.interval === 1 && r.weekdays.length === 7);
}
