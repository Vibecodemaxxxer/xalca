import {
  closestCorners,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useEffect, useMemo, useState } from 'react';
import type { Task, TaskStatus } from '../db/types';
import { moveTask, newTask } from '../domain/ops';
import { taskProgress } from '../domain/tree';
import { Az } from '../i18n/Az';
import { today } from '../lib/date';
import { Bar } from './common';
import { useData } from './data';
import { TaskSheet } from './Editors';
import { dayLabel } from './fmt';

const COLS: { id: TaskStatus; az: string }[] = [
  { id: 'todo', az: 'Görüləcək' },
  { id: 'doing', az: 'İcrada' },
  { id: 'done', az: 'Hazır' },
];
const isCol = (id: string): id is TaskStatus => COLS.some((c) => c.id === id);

/** Выполненные показываем только за последние 2 недели, чтобы колонка не росла бесконечно. */
const DONE_DAYS = 14;

type Cols = Record<TaskStatus, string[]>;

const FILTER_KEY = 'xalca.boardFilter';
function loadFilter(): { project: string; subtasks: boolean } {
  try {
    return { project: 'all', subtasks: false, ...JSON.parse(localStorage.getItem(FILTER_KEY) ?? '{}') };
  } catch {
    return { project: 'all', subtasks: false };
  }
}

export function BoardView() {
  const { tasks, projects, byId } = useData();
  const [filter, setFilterState] = useState(loadFilter);
  const [active, setActive] = useState<string | null>(null);
  const [open, setOpen] = useState<Task | null>(null);
  const [text, setText] = useState('');

  const setFilter = (f: typeof filter) => {
    setFilterState(f);
    try {
      localStorage.setItem(FILTER_KEY, JSON.stringify(f));
    } catch {
      /* не запоминаем */
    }
  };

  const derived = useMemo<Cols>(() => {
    const since = Date.now() - DONE_DAYS * 86_400_000;
    const list = tasks.filter(
      (t) =>
        (filter.subtasks || !t.parentId) &&
        (filter.project === 'all' || (filter.project === 'none' ? !t.projectId : t.projectId === filter.project)) &&
        (t.status !== 'done' || (t.completedAt ?? 0) >= since),
    );
    const out: Cols = { todo: [], doing: [], done: [] };
    for (const t of [...list].sort((a, b) => a.order - b.order)) out[t.status].push(t.id);
    return out;
  }, [tasks, filter]);

  // Во время перетаскивания держим локальную раскладку, иначе берём из базы.
  const [cols, setCols] = useState<Cols>(derived);
  useEffect(() => {
    if (!active) setCols(derived);
  }, [derived, active]);

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const findCol = (id: string): TaskStatus | undefined => (isCol(id) ? id : COLS.find((c) => cols[c.id].includes(id))?.id);

  const onDragStart = (e: DragStartEvent) => setActive(String(e.active.id));

  const onDragOver = ({ active, over }: DragOverEvent) => {
    if (!over) return;
    const from = findCol(String(active.id));
    const to = findCol(String(over.id));
    if (!from || !to || from === to) return;
    setCols((c) => {
      const id = String(active.id);
      const target = c[to];
      const idx = isCol(String(over.id)) ? target.length : Math.max(0, target.indexOf(String(over.id)));
      return { ...c, [from]: c[from].filter((x) => x !== id), [to]: [...target.slice(0, idx), id, ...target.slice(idx)] };
    });
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    const id = String(active.id);
    setActive(null);
    const col = findCol(id);
    if (!over || !col) return setCols(derived);
    let list = cols[col];
    const overIdx = list.indexOf(String(over.id));
    const curIdx = list.indexOf(id);
    if (overIdx >= 0 && overIdx !== curIdx) list = arrayMove(list, curIdx, overIdx);
    setCols({ ...cols, [col]: list });

    // Новый order — между соседями.
    const i = list.indexOf(id);
    const prev = byId.get(list[i - 1])?.order;
    const next = byId.get(list[i + 1])?.order;
    const t = byId.get(id)!;
    const order = prev != null && next != null ? (prev + next) / 2 : prev != null ? prev + 1000 : next != null ? next - 1000 : t.order;
    if (col !== t.status || order !== t.order) void moveTask(t, col, order);
  };

  const add = async () => {
    if (!text.trim()) return;
    const projectId = filter.project !== 'all' && filter.project !== 'none' ? filter.project : null;
    await newTask({ title: text.trim(), projectId });
    setText('');
  };

  const activeTask = active ? byId.get(active) : undefined;

  return (
    <>
      <div className="board-tools">
        <select value={filter.project} onChange={(e) => setFilter({ ...filter, project: e.target.value })} aria-label="Проект">
          <option value="all">Hamısı — все задачи</option>
          <option value="none">Layihəsiz — без проекта</option>
          {projects
            .filter((p) => !p.archived)
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
        </select>
        <label className="toggle">
          <input type="checkbox" checked={filter.subtasks} onChange={(e) => setFilter({ ...filter, subtasks: e.target.checked })} />
          <Az>Alt tapşırıqlar</Az>
        </label>
      </div>
      <form className="quick" onSubmit={(e) => (e.preventDefault(), add())}>
        <input type="text" placeholder="+ Yeni tapşırıq…" value={text} onChange={(e) => setText(e.target.value)} />
      </form>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={onDragStart} onDragOver={onDragOver} onDragEnd={onDragEnd} onDragCancel={() => setActive(null)}>
        <div className="board">
          {COLS.map((c) => (
            <Column key={c.id} id={c.id} title={c.az} ids={cols[c.id]} onOpen={(t) => setOpen(t)} />
          ))}
        </div>
        <DragOverlay>{activeTask && <Card task={activeTask} overlay />}</DragOverlay>
      </DndContext>

      {open && <TaskSheet task={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function Column({ id, title, ids, onOpen }: { id: TaskStatus; title: string; ids: string[]; onOpen: (t: Task) => void }) {
  const { byId } = useData();
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <section className={`board-col col-${id}${isOver ? ' over' : ''}`}>
      <h2>
        <Az>{title}</Az> <span className="count">· {ids.length}</span>
      </h2>
      <SortableContext id={id} items={ids} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="board-list">
          {ids.map((tid) => {
            const t = byId.get(tid);
            return t ? <SortableCard key={tid} task={t} onOpen={() => onOpen(t)} /> : null;
          })}
          {!ids.length && <div className="board-empty">—</div>}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableCard({ task, onOpen }: { task: Task; onOpen: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.35 : 1 }}
      {...attributes}
      {...listeners}
      onClick={onOpen}
    >
      <Card task={task} />
    </div>
  );
}

function Card({ task: t, overlay }: { task: Task; overlay?: boolean }) {
  const { children, projectById, byId } = useData();
  const p = taskProgress(t, children);
  const project = t.projectId ? projectById.get(t.projectId) : undefined;
  const parent = t.parentId ? byId.get(t.parentId) : undefined;
  const d = t.date ? dayLabel(t.date) : null;
  const late = t.status !== 'done' && !!t.date && t.date < today();
  return (
    <div className={`board-card${t.status === 'done' ? ' done' : ''}${overlay ? ' overlay' : ''}`} style={project ? { borderLeftColor: project.color } : undefined}>
      <div className="title">{t.title}</div>
      {(project || parent || d || (p && p.total > 0)) && (
        <div className="meta">
          {project && <span>{project.title}</span>}
          {parent && <span>↳ {parent.title}</span>}
          {d && (
            <span className={late ? 'late' : ''}>
              <Az ru={d.ru}>{d.az}</Az>
            </span>
          )}
          {p && p.total > 0 && (
            <span>
              {p.done}/{p.total}
            </span>
          )}
        </div>
      )}
      {p && p.total > 0 && <Bar cur={p.done} target={p.total} />}
    </div>
  );
}
