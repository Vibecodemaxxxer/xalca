import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Metric, Task, TaskSize } from '../db/types';
import { deleteTask, moveToProject, newTask, saveTask, setTaskDone } from '../domain/ops';
import { parseQuick } from '../domain/parse';
import { ancestors, descendants, taskProgress } from '../domain/tree';
import { SIZE_XP } from '../domain/xp';
import { Az } from '../i18n/Az';
import { tr } from '../i18n/lang';
import { addDays, today, weekday, type Day } from '../lib/date';
import { Bar, Check, Icon, Sheet } from './common';
import { useData } from './data';
import { dayLabel } from './fmt';
import { MdEditor } from './Markdown';
import { MetricPicker } from './pickers';

/**
 * Открыть задачу: существующую — карточкой, новую — окном быстрого ввода.
 * Имя и параметры прежние, чтобы все экраны работали без изменений.
 */
export function TaskSheet({ task, defaults, onClose }: { task?: Task; defaults?: Partial<Task>; onClose: () => void }) {
  const [current, setCurrent] = useState<Task | undefined>(task);
  if (!current) return <QuickAddSheet defaults={defaults} onClose={onClose} />;
  // key — чтобы при переходе к подзадаче/родителю состояние карточки начиналось заново
  return <TaskCard key={current.id} task={current} onClose={onClose} onOpen={setCurrent} />;
}

// ---------------- быстрый ввод ----------------

type Defaults = Partial<Pick<Task, 'date' | 'projectId' | 'parentId'>>;

/** Строка быстрого ввода: «Купить хлеб завтра 18:00 #проект !» — дата, время, проект и размер распознаются сами. */
export function QuickInput({ defaults, autoFocus, placeholder, onAdded }: { defaults?: Defaults; autoFocus?: boolean; placeholder?: string; onAdded?: (t: Task) => void }) {
  const { projects, projectById } = useData();
  const [text, setText] = useState('');
  const t = today();
  const p = text.trim() ? parseQuick(text, t, projects) : null;

  const add = async () => {
    if (!p?.title) return;
    const task = await newTask({
      title: p.title,
      date: p.date ?? defaults?.date ?? null,
      time: p.time ?? null,
      // время указано — сразу напоминание в это время
      reminder: p.time ? 0 : null,
      projectId: p.projectId ?? defaults?.projectId ?? null,
      parentId: defaults?.parentId ?? null,
      ...(p.size ? { size: p.size } : {}),
    });
    setText('');
    onAdded?.(task);
  };

  return (
    <form className="quick" onSubmit={(e) => (e.preventDefault(), void add())}>
      <input
        type="text"
        enterKeyHint="done"
        autoFocus={autoFocus}
        placeholder={placeholder ?? tr('Yeni tapşırıq…', 'Новая задача…')}
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      {p && p.found.length > 0 && (
        <div className="parsed">
          {p.found.map((f, i) => (
            <span key={i} className={f.kind}>
              {f.kind === 'date' && p.date ? dayLabel(p.date).ru : f.kind === 'project' && p.projectId ? projectById.get(p.projectId)?.title : f.kind === 'size' ? 'большая +25' : f.text}
            </span>
          ))}
        </div>
      )}
    </form>
  );
}

function QuickAddSheet({ defaults, onClose }: { defaults?: Defaults; onClose: () => void }) {
  const [added, setAdded] = useState<Task[]>([]);
  return (
    <Sheet title={<Az>Yeni tapşırıq</Az>} onClose={onClose}>
      <QuickInput defaults={defaults} autoFocus onAdded={(t) => setAdded((a) => [...a, t])} />
      <p className="hint" style={{ margin: '4px 2px 0' }}>
        Например: <b>Позвонить врачу завтра 10:00</b>, <b>Отчёт в пятницу !</b>, <b>Плитка #ремонт</b>
        <br />
        <b>!</b> — большая задача, <b>#</b> — проект. Enter — добавить и сразу писать следующую.
      </p>
      {added.length > 0 && (
        <div className="list" style={{ marginTop: 8 }}>
          {added.map((t) => (
            <div key={t.id} className="row">
              <span className="ico" style={{ color: 'var(--green)' }}>
                {Icon.check}
              </span>
              <div className="body">
                <div className="title">{t.title}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="actions">
        <button className="btn" onClick={onClose}>
          <Az>Hazır</Az>
        </button>
      </div>
    </Sheet>
  );
}

// ---------------- карточка задачи ----------------

type Prop = 'date' | 'project' | 'size' | 'metric' | null;

const SIZES: { v: TaskSize; az: string; ru: string }[] = [
  { v: 's', az: 'Kiçik', ru: 'Маленькая' },
  { v: 'm', az: 'Orta', ru: 'Обычная' },
  { v: 'l', az: 'Böyük', ru: 'Большая' },
];

const METRIC_LABEL: Record<Metric['type'], { az: string; ru: string }> = {
  check: { az: 'Məqsəd', ru: 'Цель' },
  number: { az: 'Say', ru: 'Число' },
  criteria: { az: 'Meyarlar', ru: 'Критерии' },
  subtasks: { az: 'Alt tapşırıqlar', ru: 'По подзадачам' },
};

function TaskCard({ task, onClose, onOpen }: { task: Task; onClose: () => void; onOpen: (t: Task) => void }) {
  const { byId, children, projects, projectById } = useData();
  const live = byId.get(task.id) ?? task;
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [open, setOpen] = useState<Prop>(null);
  const [menu, setMenu] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);

  // Название и описание сохраняются сами — с небольшой задержкой и при закрытии.
  const pending = useRef<{ title: string; description: string } | null>(null);
  const flush = () => {
    const p = pending.current;
    pending.current = null;
    if (p && p.title.trim()) void saveTask(task.id, { title: p.title.trim(), description: p.description });
  };
  useEffect(() => {
    if (title === live.title && description === live.description) return;
    pending.current = { title, description };
    const t = setTimeout(flush, 500);
    return () => clearTimeout(t);
  }, [title, description]);
  useEffect(() => () => flush(), []);

  // высота поля названия — по тексту
  useEffect(() => {
    const el = titleRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [title]);

  const set = (fields: Partial<Task>) => saveTask(task.id, fields);
  const go = (t: Task) => {
    flush();
    onOpen(t);
  };

  const chain = ancestors(live, byId);
  const subs = children.get(live.id) ?? [];
  const done = live.status === 'done';
  const size = live.size ?? 'm';
  const project = live.projectId ? projectById.get(live.projectId) : undefined;
  const late = !done && !!live.date && live.date < today();
  const toggle = (p: Prop) => setOpen(open === p ? null : p);

  return (
    <Sheet title={null} onClose={() => (flush(), onClose())} panel>
      {chain.length > 0 && (
        <div className="crumbs">
          {chain.map((p) => (
            <button key={p.id} className="crumb" onClick={() => go(p)}>
              {p.title}
            </button>
          ))}
        </div>
      )}

      <div className="tc-head">
        <Check on={done} onToggle={() => void setTaskDone(live, !done)} />
        <textarea
          ref={titleRef}
          className="tc-title"
          rows={1}
          value={title}
          onChange={(e) => setTitle(e.target.value.replace(/\n/g, ' '))}
          aria-label="Название"
        />
        <button className="btn ghost tc-more" onClick={() => setMenu(!menu)} aria-label="Ещё">
          ⋯
        </button>
      </div>

      {menu && (
        <div className="tc-menu">
          <button
            className="danger"
            onClick={() => {
              const n = descendants(live.id, children).length;
              if (confirm(n ? `Удалить задачу и подзадачи (${n})?` : 'Удалить задачу?')) void deleteTask(live).then(onClose);
            }}
          >
            <Az ru="Удалить задачу">Tapşırığı sil</Az>
          </button>
        </div>
      )}

      <div className="props">
        <PropChip icon={Icon.today} on={open === 'date'} set={!!live.date} late={late} onClick={() => toggle('date')}>
          {live.date ? (
            <Az ru={dayLabel(live.date).ru + (live.time ? ` ${live.time}` : '')} full>
              {dayLabel(live.date).az + (live.time ? ` ${live.time}` : '')}
            </Az>
          ) : (
            <Az>Tarix</Az>
          )}
          {live.reminder != null && <span className="ico">{Icon.bell}</span>}
        </PropChip>
        {!live.parentId && (
          <PropChip icon={Icon.projects} on={open === 'project'} set={!!project} onClick={() => toggle('project')}>
            {project ? project.title : <Az>Layihə</Az>}
          </PropChip>
        )}
        <PropChip icon={<span className="abbasi-dot">★</span>} on={open === 'size'} set={size !== 'm'} big={size === 'l'} onClick={() => toggle('size')}>
          <Az ru={`${SIZES.find((s) => s.v === size)!.ru} +${SIZE_XP[size]}`} full>{`${SIZES.find((s) => s.v === size)!.az} +${SIZE_XP[size]}`}</Az>
        </PropChip>
        <PropChip icon={Icon.check} on={open === 'metric'} set={live.metric.type !== 'check'} onClick={() => toggle('metric')}>
          <Az ru={METRIC_LABEL[live.metric.type].ru} full>
            {METRIC_LABEL[live.metric.type].az}
          </Az>
        </PropChip>
      </div>

      {open === 'date' && <DatePanel task={live} onChange={set} />}
      {open === 'project' && (
        <div className="prop-panel">
          <div className="prop-list">
            <button className={!live.projectId ? 'on' : ''} onClick={() => void moveToProject(live, null).then(() => setOpen(null))}>
              <Az>Layihəsiz</Az>
            </button>
            {projects
              .filter((p) => !p.archived && !p.completedAt)
              .map((p) => (
                <button key={p.id} className={live.projectId === p.id ? 'on' : ''} onClick={() => void moveToProject(live, p.id).then(() => setOpen(null))}>
                  <i className="pdot" style={{ background: p.color }} />
                  {p.title}
                </button>
              ))}
          </div>
        </div>
      )}
      {open === 'size' && (
        <div className="prop-panel">
          <div className="seg size-seg">
            {SIZES.map((s) => (
              <button key={s.v} className={`${size === s.v ? 'on' : ''} ${s.v}`} onClick={() => void set({ size: s.v }).then(() => setOpen(null))}>
                <Az ru={`${s.ru} · +${SIZE_XP[s.v]}`} full>{`${s.az} · +${SIZE_XP[s.v]}`}</Az>
              </button>
            ))}
          </div>
          <span className="hint">Больше задача — больше опыта и abbası.</span>
        </div>
      )}
      {open === 'metric' && (
        <div className="prop-panel">
          <MetricPicker
            value={live.metric}
            onChange={(m) => void set({ metric: m.type === 'number' && live.metric.type === 'number' ? { ...m, current: live.metric.current } : m })}
            kinds={['check', 'number', 'criteria', 'subtasks']}
          />
        </div>
      )}

      <div className="tc-section">
        <MdEditor value={description} onChange={setDescription} startInPreview />
      </div>

      <div className="tc-section">
        <h3>
          <Az>Alt tapşırıqlar</Az> {subs.length > 0 && `· ${subs.filter((s) => s.status === 'done').length}/${subs.length}`}
        </h3>
        <div className="list subs">
          {subs.map((s) => (
            <SubRow key={s.id} task={s} onOpen={() => go(s)} />
          ))}
        </div>
        <SubAdd parent={live} />
      </div>
    </Sheet>
  );
}

function PropChip({ icon, on, set, late, big, onClick, children }: { icon: ReactNode; on: boolean; set: boolean; late?: boolean; big?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button className={`prop${on ? ' open' : ''}${set ? ' set' : ''}${late ? ' late' : ''}${big ? ' big' : ''}`} onClick={onClick}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

function DatePanel({ task, onChange }: { task: Task; onChange: (f: Partial<Task>) => Promise<void> }) {
  const t = today();
  const weekend = addDays(t, (5 - weekday(t) + 7) % 7 || 7);
  const quick: { d: Day | null; az: string; ru: string }[] = [
    { d: t, az: 'Bu gün', ru: 'Сегодня' },
    { d: addDays(t, 1), az: 'Sabah', ru: 'Завтра' },
    { d: weekend, az: 'Həftə sonu', ru: 'На выходных' },
    { d: addDays(t, 7), az: '+1 həftə', ru: 'Через неделю' },
    { d: null, az: 'Tarixsiz', ru: 'Без даты' },
  ];
  const setDate = (d: Day | null) => onChange(d ? { date: d } : { date: null, time: null, reminder: null });
  return (
    <div className="prop-panel">
      <div className="seg">
        {quick.map((q) => (
          <button key={q.az} className={task.date === q.d || (!task.date && !q.d) ? 'on' : ''} onClick={() => void setDate(q.d)}>
            <Az ru={q.ru} full>
              {q.az}
            </Az>
          </button>
        ))}
      </div>
      <div className="grid2">
        <label className="field">
          <span>
            <Az>Tarix</Az>
          </span>
          <input type="date" value={task.date ?? ''} onChange={(e) => void setDate(e.target.value || null)} />
        </label>
        <label className="field">
          <span>
            <Az>Vaxt</Az>
          </span>
          <input
            type="time"
            value={task.time ?? ''}
            disabled={!task.date}
            onChange={(e) => void onChange(e.target.value ? { time: e.target.value, reminder: task.reminder ?? 0 } : { time: null, reminder: null })}
          />
        </label>
      </div>
      {task.time && (
        <div className="field">
          <span>
            <Az>Xatırlatma</Az>
          </span>
          <div className="seg">
            {[
              { v: null, az: 'Yox', ru: 'Нет' },
              { v: 0, az: 'Vaxtında', ru: 'Вовремя' },
              { v: 15, az: '15 dəq', ru: 'За 15 мин' },
              { v: 60, az: '1 saat', ru: 'За час' },
            ].map((r) => (
              <button key={String(r.v)} className={task.reminder === r.v ? 'on' : ''} onClick={() => void onChange({ reminder: r.v })}>
                <Az ru={r.ru} full>
                  {r.az}
                </Az>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SubRow({ task: t, onOpen }: { task: Task; onOpen: () => void }) {
  const { children } = useData();
  const done = t.status === 'done';
  const p = taskProgress(t, children);
  return (
    <div className={`row${done ? ' done' : ''}`}>
      <Check on={done} onToggle={() => void setTaskDone(t, !done)} />
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

/**
 * Добавление подзадачи. Отдельная форма: Enter на любой клавиатуре (в т.ч. Android) отправляет именно её.
 * Недописанное сохраняется, когда уходишь из поля.
 */
export function SubAdd({ parent, autoFocus, onDone }: { parent: Task; autoFocus?: boolean; onDone?: () => void }) {
  const [text, setText] = useState('');
  const add = async () => {
    const title = text.trim();
    if (!title) return;
    setText('');
    await newTask({ title, parentId: parent.id });
  };
  return (
    <form className="sub-add" onSubmit={(e) => (e.preventDefault(), void add())}>
      <input
        type="text"
        enterKeyHint="enter"
        autoFocus={autoFocus}
        placeholder={tr('Alt tapşırıq…', 'Подзадача…')}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => {
          if (text.trim()) void add();
          else onDone?.();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            setText('');
            onDone?.();
          }
        }}
      />
      <button type="submit" className="btn small" disabled={!text.trim()} aria-label="Добавить подзадачу">
        +
      </button>
    </form>
  );
}
