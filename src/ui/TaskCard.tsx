import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Metric, Task, TaskSize } from '../db/types';
import { deleteTask, moveToProject, newTask, saveTask, setTaskDone } from '../domain/ops';
import { ancestors, descendants } from '../domain/tree';
import { SIZE_XP } from '../domain/xp';
import { Az } from '../i18n/Az';
import { tr } from '../i18n/lang';
import { addDays, today, weekday, type Day } from '../lib/date';
import { Check, Icon, Sheet } from './common';
import { useData } from './data';
import { EmojiPicker } from './emoji';
import { dayLabel } from './fmt';
import { MdEditor } from './Markdown';
import { MetricPicker } from './pickers';
import { TaskTree } from './TaskTree';

type Defaults = Partial<Pick<Task, 'date' | 'projectId' | 'parentId'>>;

/**
 * Окно задачи. Существующая открывается сразу; новая — тем же окном-черновиком:
 * задача появляется, как только у неё есть название.
 */
export function TaskSheet({ task, defaults, onClose }: { task?: Task; defaults?: Partial<Task>; onClose: () => void }) {
  const [current, setCurrent] = useState<Task | undefined>(task);
  // key — чтобы при переходе к подзадаче/родителю состояние окна начиналось заново
  return <TaskCard key={current?.id ?? 'new'} task={current} defaults={defaults} onClose={onClose} onOpen={setCurrent} />;
}

/** Простое поле над списком: что написал — то и название задачи. */
export function QuickInput({ defaults, autoFocus, placeholder, onAdded }: { defaults?: Defaults; autoFocus?: boolean; placeholder?: string; onAdded?: (t: Task) => void }) {
  const [text, setText] = useState('');
  const add = async () => {
    const title = text.trim();
    if (!title) return;
    setText('');
    const t = await newTask({ title, date: defaults?.date ?? null, projectId: defaults?.projectId ?? null, parentId: defaults?.parentId ?? null });
    onAdded?.(t);
  };
  return (
    <form className="quick" onSubmit={(e) => (e.preventDefault(), void add())}>
      <input type="text" enterKeyHint="done" autoFocus={autoFocus} placeholder={placeholder ?? tr('Yeni tapşırıq…', 'Новая задача…')} value={text} onChange={(e) => setText(e.target.value)} />
    </form>
  );
}

// ---------------- окно задачи ----------------

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

const BLANK = (d?: Partial<Task>): Task => ({
  id: '',
  createdAt: 0,
  updatedAt: 0,
  _ts: {},
  title: '',
  description: '',
  images: [],
  status: 'todo',
  metric: { type: 'check' },
  order: 0,
  date: d?.date ?? null,
  time: null,
  reminder: null,
  projectId: d?.projectId ?? null,
  parentId: d?.parentId ?? null,
  completedAt: null,
  icon: null,
});

function TaskCard({ task, defaults, onClose, onOpen }: { task?: Task; defaults?: Partial<Task>; onClose: () => void; onOpen: (t: Task) => void }) {
  const { byId, children, projects, projectById } = useData();
  // id появляется, когда черновик стал задачей
  const [id, setId] = useState<string | null>(task?.id ?? null);
  const [draft, setDraft] = useState<Task>(() => task ?? BLANK(defaults));
  const live = (id && byId.get(id)) || draft;
  const [title, setTitle] = useState(task?.title ?? '');
  const [description, setDescription] = useState(task?.description ?? '');
  const [open, setOpen] = useState<Prop>(null);
  const [menu, setMenu] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const creating = useRef<Promise<Task | null> | null>(null);
  const idRef = useRef(id);
  idRef.current = id;

  /** Создать задачу из черновика (один раз), если есть название. */
  const ensure = (): Promise<Task | null> => {
    if (idRef.current) return Promise.resolve(byId.get(idRef.current) ?? null);
    if (!titleNow.current.trim()) return Promise.resolve(null);
    creating.current ??= (async () => {
      const d = draftRef.current;
      const t = await newTask({
        title: titleNow.current.trim(),
        description: descNow.current,
        date: d.date,
        time: d.time,
        reminder: d.reminder,
        projectId: d.projectId,
        parentId: d.parentId,
        size: d.size,
        metric: d.metric,
        icon: d.icon,
      });
      idRef.current = t.id;
      setId(t.id);
      return t;
    })();
    return creating.current;
  };

  // актуальные значения для отложенных сохранений
  const titleNow = useRef(title);
  const descNow = useRef(description);
  const draftRef = useRef(draft);
  titleNow.current = title;
  descNow.current = description;
  draftRef.current = draft;

  // Название и описание сохраняются сами — с небольшой задержкой и при закрытии.
  const flush = () => {
    if (!titleNow.current.trim()) return;
    if (idRef.current) void saveTask(idRef.current, { title: titleNow.current.trim(), description: descNow.current });
    else void ensure();
  };
  useEffect(() => {
    if (id && title === live.title && description === live.description) return;
    const t = setTimeout(flush, 500);
    return () => clearTimeout(t);
  }, [title, description]);
  useEffect(() => () => flush(), []);

  useEffect(() => {
    const el = titleRef.current;
    if (el) {
      el.style.height = 'auto';
      el.style.height = `${el.scrollHeight}px`;
    }
  }, [title]);

  /** Поменять свойства: у задачи — сразу в базу, у черновика — пока в черновик. */
  const set = async (fields: Partial<Task>) => {
    if (idRef.current) await saveTask(idRef.current, fields);
    else setDraft((d) => ({ ...d, ...fields }));
  };
  const setProject = async (projectId: string | null) => {
    if (idRef.current) await moveToProject(live, projectId);
    else setDraft((d) => ({ ...d, projectId }));
  };
  const go = (t: Task) => {
    flush();
    onOpen(t);
  };

  const chain = id ? ancestors(live, byId) : live.parentId && byId.get(live.parentId) ? [...ancestors(byId.get(live.parentId)!, byId), byId.get(live.parentId)!] : [];
  const subs = id ? (children.get(id) ?? []) : [];
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
              {p.icon ? `${p.icon} ` : ''}
              {p.title}
            </button>
          ))}
        </div>
      )}

      <div className="tc-head">
        <Check on={done} onToggle={() => id && void setTaskDone(live, !done)} />
        <button className={`tc-emoji${live.icon ? ' set' : ''}`} onClick={() => setEmoji(true)} aria-label="Эмодзи">
          {live.icon || '☺'}
        </button>
        <textarea
          ref={titleRef}
          className="tc-title"
          rows={1}
          autoFocus={!task}
          placeholder={tr('Tapşırığın adı', 'Название задачи')}
          value={title}
          onChange={(e) => setTitle(e.target.value.replace(/\n/g, ' '))}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), flush())}
          aria-label="Название"
        />
        {id && (
          <button className="btn ghost tc-more" onClick={() => setMenu(!menu)} aria-label="Ещё">
            ⋯
          </button>
        )}
      </div>

      {menu && id && (
        <div className="tc-menu">
          <button
            className="danger"
            onClick={() => {
              const n = descendants(id, children).length;
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
        <PropChip icon={<span>★</span>} on={open === 'size'} set={size !== 'm'} big={size === 'l'} onClick={() => toggle('size')}>
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
            <button className={!live.projectId ? 'on' : ''} onClick={() => void setProject(null).then(() => setOpen(null))}>
              <Az>Layihəsiz</Az>
            </button>
            {projects
              .filter((p) => !p.archived && !p.completedAt)
              .map((p) => (
                <button key={p.id} className={live.projectId === p.id ? 'on' : ''} onClick={() => void setProject(p.id).then(() => setOpen(null))}>
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
        <MdEditor value={description} onChange={setDescription} />
      </div>

      <div className="tc-section">
        <h3>
          <Az>Alt tapşırıqlar</Az> {subs.length > 0 && `· ${subs.filter((s) => s.status === 'done').length}/${subs.length}`}
        </h3>
        {subs.length > 0 && <TaskTree items={subs} onOpen={go} />}
        {id ? <SubAdd parent={live} /> : <SubAddDraft ensure={ensure} />}
      </div>

      {emoji && <EmojiPicker value={live.icon} onPick={(e) => void set({ icon: e })} onClose={() => setEmoji(false)} />}
    </Sheet>
  );
}

/** Подзадача у ещё не созданной задачи: сначала создаём задачу (нужно название). */
function SubAddDraft({ ensure }: { ensure: () => Promise<Task | null> }) {
  const [text, setText] = useState('');
  const [warn, setWarn] = useState(false);
  const add = async () => {
    const title = text.trim();
    if (!title) return;
    const parent = await ensure();
    if (!parent) return setWarn(true);
    setText('');
    setWarn(false);
    await newTask({ title, parentId: parent.id });
  };
  return (
    <>
      <form className="sub-add" onSubmit={(e) => (e.preventDefault(), void add())}>
        <input type="text" enterKeyHint="enter" placeholder={tr('Alt tapşırıq…', 'Подзадача…')} value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit" className="btn small" disabled={!text.trim()} aria-label="Добавить подзадачу">
          +
        </button>
      </form>
      {warn && <p className="hint">Сначала напиши название задачи.</p>}
    </>
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
