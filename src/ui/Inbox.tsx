import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ClipboardEvent, type PointerEvent } from 'react';
import { remove, update } from '../db/db';
import type { Note, Project, Task } from '../db/types';
import { isOpen, matches, noteToTask, pieces, splitNumbered } from '../domain/notes';
import { keepNote, markNoteMoved, newNote, noteToProject, noteToProjectNotes, noteToTaskOp, notesToTask } from '../domain/ops';
import { NOTE_XP } from '../domain/notes';
import { Az } from '../i18n/Az';
import { tr } from '../i18n/lang';
import { toDay } from '../lib/date';
import { addImage, imageUrl } from '../sync/images';
import { Buta, Icon, Sheet } from './common';
import { useData } from './data';
import { RoutineSheet, TaskSheet } from './Editors';
import { dayLabel } from './fmt';

// «Saxlanılanlar» — избранное как в Telegram: быстро скинуть мысль, ссылку или картинку,
// а потом разобрать в задачи и проекты.

export function InboxScreen({ mode }: { mode?: string }) {
  return mode === 'razbor' ? <Triage /> : <Feed />;
}

// ---------------- лента ----------------

function Feed() {
  const { notes, byId } = useData();
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [menu, setMenu] = useState<Note | null>(null);
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [openTask, setOpenTask] = useState<Task | null>(null);
  const [routineFrom, setRoutineFrom] = useState<Note | null>(null);
  const [projectFor, setProjectFor] = useState<Note | null>(null);
  const [merge, setMerge] = useState<Note[] | null>(null);
  const feed = useRef<HTMLDivElement>(null);

  const shown = notes.filter((n) => matches(n, q));
  const pinned = notes.filter((n) => n.pinned);
  const open = notes.filter(isOpen).length;

  // при открытии и новых сообщениях — вниз, как в мессенджере
  useLayoutEffect(() => {
    const f = feed.current;
    if (f && !q) f.scrollTop = f.scrollHeight;
  }, [notes.length, q]);

  const toggleSel = (n: Note) => {
    const next = new Set(selected);
    if (next.has(n.id)) next.delete(n.id);
    else next.add(n.id);
    setSelected(next.size ? next : null);
  };

  const groups = useMemo(() => {
    const out: { day: string; items: Note[] }[] = [];
    for (const n of shown) {
      const d = toDay(new Date(n.createdAt));
      if (out[out.length - 1]?.day !== d) out.push({ day: d, items: [] });
      out[out.length - 1].items.push(n);
    }
    return out;
  }, [shown]);

  const selNotes = selected ? notes.filter((n) => selected.has(n.id)) : [];

  return (
    <div className="inbox">
      <div className="inbox-top">
      <div className="page-head">
        <div>
          <h1>
            <Az>Saxlanılanlar</Az>
          </h1>
          <div className="sub">
            {open > 0 ? (
              <Az ru={`Не разобрано: ${open}`} full>{`Baxılmayıb: ${open}`}</Az>
            ) : (
              <Az ru="Всё разобрано" full>
                Hamısı səliqəlidir
              </Az>
            )}
          </div>
        </div>
        <div className="today-tools">
          <button className="btn ghost" onClick={() => (setSearching(!searching), setQ(''))} aria-label="Поиск">
            <span className="ico">{Icon.search}</span>
          </button>
          {open > 0 && (
            <button className="btn gold" onClick={() => (location.hash = 'inbox/razbor')}>
              <Az ru="Разобрать">Səliqəyə sal</Az> · {open}
            </button>
          )}
        </div>
      </div>

      {searching && <input type="search" autoFocus placeholder={tr('Axtar… (#teq də olar)', 'Поиск… (можно #тег)')} value={q} onChange={(e) => setQ(e.target.value)} className="inbox-search" />}

      {pinned.length > 0 && !q && (
        <button className="pinned" onClick={() => document.getElementById(`note-${pinned[pinned.length - 1].id}`)?.scrollIntoView({ block: 'center' })}>
          <span className="ico">{Icon.pin}</span>
          <span className="pinned-text">{pinned[pinned.length - 1].text || 'Картинка'}</span>
        </button>
      )}

      </div>

      <div className="feed" ref={feed}>
        <div className="feed-inner">
      {!notes.length && (
        <div className="empty">
          <Buta />
          <p>
            <Az ru="Сюда — любые мысли, ссылки, картинки. Как «Избранное» в Telegram. Потом разберёшь их в задачи и проекты." full>
              Fikirlərini, linkləri, şəkilləri bura at
            </Az>
          </p>
        </div>
      )}

        {groups.map((g) => (
          <div key={g.day}>
            <div className="day-sep">
              <span>
                <Az ru={dayLabel(g.day).ru} full>
                  {dayLabel(g.day).az}
                </Az>
              </span>
            </div>
            {g.items.map((n) => (
              <Bubble
                key={n.id}
                note={n}
                selected={selected?.has(n.id)}
                selecting={!!selected}
                onTag={(t) => (setSearching(true), setQ(t))}
                onMenu={() => (selected ? toggleSel(n) : setMenu(n))}
                onTap={() => selected && toggleSel(n)}
                onOpenMoved={(id) => {
                  if (n.movedTo?.kind === 'task') {
                    const t = byId.get(id);
                    if (t) setOpenTask(t);
                  } else if (n.movedTo?.kind === 'routine') location.hash = 'routines';
                  else if (n.movedTo) location.hash = `projects/${id}`;
                }}
              />
            ))}
          </div>
        ))}
        </div>
      </div>

      {selected ? (
        <div className="composer select-bar">
          <button className="btn ghost" onClick={() => setSelected(null)}>
            <Az>Ləğv et</Az>
          </button>
          <span className="sel-count">{selected.size}</span>
          <button className="btn primary" disabled={!selNotes.length} onClick={() => setMerge(selNotes)}>
            → <Az ru="Одна задача">Bir tapşırıq</Az>
          </button>
          <button
            className="btn danger"
            onClick={() => confirm(`Удалить сообщения (${selected.size})?`) && void Promise.all(selNotes.map((n) => remove('notes', n.id))).then(() => setSelected(null))}
          >
            <Az>Sil</Az>
          </button>
        </div>
      ) : (
        <Composer />
      )}

      {menu && (
        <NoteMenu
          note={menu}
          onClose={() => setMenu(null)}
          onTask={async () => {
            const t = await noteToTaskOp(menu);
            setMenu(null);
            setOpenTask(t);
          }}
          onProject={() => (setProjectFor(menu), setMenu(null))}
          onRoutine={() => (setRoutineFrom(menu), setMenu(null))}
          onSelect={() => (setSelected(new Set([menu.id])), setMenu(null))}
        />
      )}
      {projectFor && <ProjectPicker note={projectFor} onClose={() => setProjectFor(null)} />}
      {merge && <MergeSheet notes={merge} onClose={() => setMerge(null)} onDone={(t) => (setMerge(null), setSelected(null), setOpenTask(t))} />}
      {openTask && <TaskSheet task={openTask} onClose={() => setOpenTask(null)} />}
      {routineFrom && (
        <RoutineSheet
          defaults={{ title: noteToTask(routineFrom).title, description: noteToTask(routineFrom).description }}
          onCreated={(r) => void markNoteMoved(routineFrom, { kind: 'routine', id: r.id, title: r.title })}
          onClose={() => setRoutineFrom(null)}
        />
      )}
    </div>
  );
}

function NoteImage({ hash, zoom = true }: { hash: string; zoom?: boolean }) {
  const [url, setUrl] = useState<string | null | undefined>();
  useEffect(() => {
    let alive = true;
    void imageUrl(hash).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [hash]);
  if (url === undefined) return <span className="img-ph">…</span>;
  if (url === null) return <span className="img-ph">не загружена</span>;
  return <img src={url} alt="" onClick={zoom ? (e) => (e.stopPropagation(), window.open(url, '_blank')) : undefined} />;
}

function Bubble({
  note: n,
  selected,
  selecting,
  onTag,
  onMenu,
  onTap,
  onOpenMoved,
}: {
  note: Note;
  selected?: boolean;
  selecting: boolean;
  onTag: (t: string) => void;
  onMenu: () => void;
  onTap: () => void;
  onOpenMoved: (id: string) => void;
}) {
  const press = useRef<ReturnType<typeof setTimeout>>();
  const moved = n.movedTo;
  const time = new Date(n.createdAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  const LABEL = { task: 'задача', project: 'проект', routine: 'привычка', projectNote: 'заметки проекта' } as const;

  return (
    <div
      id={`note-${n.id}`}
      className={`bubble-row${selected ? ' sel' : ''}`}
      onClick={onTap}
      onContextMenu={(e) => (e.preventDefault(), onMenu())}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse') return;
        press.current = setTimeout(onMenu, 450);
      }}
      onPointerUp={() => clearTimeout(press.current)}
      onPointerMove={() => clearTimeout(press.current)}
      onPointerCancel={() => clearTimeout(press.current)}
    >
      {selecting && <span className={`sel-dot${selected ? ' on' : ''}`}>{Icon.check}</span>}
      <div className={`bubble${moved ? ' moved' : ''}${n.reviewed ? ' kept' : ''}`}>
        {n.images.length > 0 && (
          <div className={`bubble-imgs n${Math.min(n.images.length, 3)}`}>
            {n.images.map((h) => (
              // в режиме выбора тап по картинке выбирает сообщение, а не открывает её
              <NoteImage key={h} hash={h} zoom={!selecting} />
            ))}
          </div>
        )}
        {n.text && (
          <div className="bubble-text">
            {pieces(n.text).map((p, i) =>
              p.kind === 'url' ? (
                <a key={i} href={p.text.startsWith('http') ? p.text : `https://${p.text}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                  {p.text}
                </a>
              ) : p.kind === 'tag' ? (
                <button key={i} className="tag" onClick={(e) => (e.stopPropagation(), onTag(p.text))}>
                  {p.text}
                </button>
              ) : (
                <span key={i}>{p.text}</span>
              ),
            )}
          </div>
        )}
        <div className="bubble-foot">
          {n.pinned && <span className="ico">{Icon.pin}</span>}
          {moved && (
            <button className="moved-link" onClick={(e) => (e.stopPropagation(), onOpenMoved(moved.id))}>
              → {LABEL[moved.kind]}: {moved.title}
            </button>
          )}
          <span className="bubble-time">{time}</span>
          {!selecting && (
            <button className="bubble-more" onClick={(e) => (e.stopPropagation(), onMenu())} aria-label="Действия">
              ⋯
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Кнопки у поля ввода не забирают фокус: иначе на телефоне клавиатура закрывается, меню возвращается,
// экран сдвигается — и нажатие «Отправить» промахивается.
const keepFocus = (e: PointerEvent) => e.preventDefault();

function Composer() {
  const [text, setText] = useState('');
  const [imgs, setImgs] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  const attach = async (files: Blob[]) => {
    if (!files.length) return;
    setBusy(true);
    try {
      const hs: string[] = [];
      for (const f of files) hs.push(await addImage(f));
      setImgs((x) => [...x, ...hs]);
    } finally {
      setBusy(false);
    }
  };

  // нумерованный план («1. … 2. …») уходит отдельными сообщениями — их удобно раскидать по одному
  const parts = splitNumbered(text.trim());
  const send = async () => {
    if (!text.trim() && !imgs.length) return;
    for (const [k, part] of parts.entries()) await newNote(part, k === 0 ? imgs : []);
    setText('');
    setImgs([]);
    ta.current?.focus();
  };

  return (
    <form className="composer" onSubmit={(e) => (e.preventDefault(), void send())}>
      {parts.length > 1 && (
        <div className="composer-split">
          <Az ru={`Уйдёт ${parts.length} отдельными сообщениями`} full>{`${parts.length} ayrı mesaj kimi gedəcək`}</Az>
        </div>
      )}
      {imgs.length > 0 && (
        <div className="composer-imgs">
          {imgs.map((h) => (
            <span key={h} className="composer-img">
              <NoteImage hash={h} />
              <button type="button" onClick={() => setImgs((x) => x.filter((y) => y !== h))} aria-label="Убрать">
                ×
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="composer-row">
        <button type="button" className="composer-btn" onPointerDown={keepFocus} onClick={() => file.current?.click()} disabled={busy} aria-label="Прикрепить картинку">
          {Icon.clip}
        </button>
        <textarea
          ref={ta}
          rows={1}
          value={text}
          placeholder={tr('Fikir, link, şəkil…', 'Мысль, ссылка, картинка…')}
          onChange={(e) => setText(e.target.value)}
          // пока печатаешь на телефоне — нижнее меню прячется, как в мессенджерах
          onFocus={() => document.documentElement.classList.add('typing')}
          onBlur={() => document.documentElement.classList.remove('typing')}
          onPaste={(e: ClipboardEvent) => {
            const fs = [...e.clipboardData.items].filter((i) => i.type.startsWith('image/')).map((i) => i.getAsFile()!).filter(Boolean);
            if (fs.length) (e.preventDefault(), void attach(fs));
          }}
          onKeyDown={(e) => {
            // на ПК Enter — отправить, Shift+Enter — новая строка; на телефоне Enter — новая строка
            if (e.key === 'Enter' && !e.shiftKey && matchMedia('(hover: hover)').matches) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button type="submit" className="composer-send" onPointerDown={keepFocus} disabled={!text.trim() && !imgs.length} aria-label="Отправить">
          {Icon.send}
        </button>
      </div>
      <input ref={file} type="file" accept="image/*" multiple hidden onChange={(e) => (void attach([...(e.target.files ?? [])]), (e.target.value = ''))} />
    </form>
  );
}

function NoteMenu({ note: n, onClose, onTask, onProject, onRoutine, onSelect }: { note: Note; onClose: () => void; onTask: () => void; onProject: () => void; onRoutine: () => void; onSelect: () => void }) {
  return (
    <Sheet onClose={onClose}>
      <p className="menu-preview">{n.text || 'Картинка'}</p>
      <div className="tc-menu">
        <button onClick={onTask}>
          → <Az ru="В задачу">Tapşırığa</Az>
        </button>
        <button onClick={onProject}>
          → <Az ru="В проект">Layihəyə</Az>
        </button>
        <button onClick={onRoutine}>
          → <Az ru="В привычку">Vərdişə</Az>
        </button>
        <button onClick={onSelect}>
          <Az ru="Выбрать несколько">Bir neçəsini seç</Az>
        </button>
        <button onClick={() => (void navigator.clipboard?.writeText(n.text), onClose())}>
          <Az ru="Копировать текст">Kopyala</Az>
        </button>
        <button onClick={() => (void update<Note>('notes', n.id, { pinned: !n.pinned }), onClose())}>
          <Az ru={n.pinned ? 'Открепить' : 'Закрепить'} full>
            {n.pinned ? 'Bərkidilməni götür' : 'Bərkid'}
          </Az>
        </button>
        {(n.movedTo || n.reviewed) && (
          <button onClick={() => (void update<Note>('notes', n.id, { movedTo: null, reviewed: false, processedAt: null }), onClose())}>
            <Az ru="Вернуть в неразобранные">Baxılmamışa qaytar</Az>
          </button>
        )}
        <button className="danger" onClick={() => (void remove('notes', n.id), onClose())}>
          <Az>Sil</Az>
        </button>
      </div>
    </Sheet>
  );
}

function ProjectPicker({ note, onClose, onMoved }: { note: Note; onClose: () => void; onMoved?: () => void }) {
  const { projects } = useData();
  const [project, setProject] = useState<Project | null>(null);
  const done = () => (onMoved?.(), onClose());
  return (
    <Sheet title={<Az ru="В какой проект?">Hansı layihəyə?</Az>} onClose={onClose}>
      {!project ? (
        <div className="prop-list">
          {projects
            .filter((p) => !p.archived && !p.completedAt)
            .map((p) => (
              <button key={p.id} onClick={() => setProject(p)}>
                <i className="pdot" style={{ background: p.color }} />
                {p.title}
              </button>
            ))}
          <button onClick={() => void noteToProject(note).then(done)}>
            + <Az ru="Новый проект из этого сообщения">Yeni layihə</Az>
          </button>
        </div>
      ) : (
        <div className="choice">
          <button className="btn primary" onClick={() => void noteToTaskOp(note, project.id).then(done)}>
            <Az ru="Задачей в проекте">Tapşırıq kimi</Az>
          </button>
          <button className="btn" onClick={() => void noteToProjectNotes(note, project).then(done)}>
            <Az ru="Дописать в заметки проекта">Qeydlərə əlavə et</Az>
          </button>
          <button className="btn ghost" onClick={() => setProject(null)}>
            <Az>Geri</Az>
          </button>
        </div>
      )}
    </Sheet>
  );
}

function MergeSheet({ notes, onClose, onDone }: { notes: Note[]; onClose: () => void; onDone: (t: Task) => void }) {
  const [title, setTitle] = useState(noteToTask(notes[0]).title);
  return (
    <Sheet title={<Az ru="Одна задача из сообщений">Bir tapşırıq</Az>} onClose={onClose}>
      <p className="hint">Каждое из {notes.length} сообщений станет подзадачей.</p>
      <form onSubmit={(e) => (e.preventDefault(), title.trim() && void notesToTask(notes, title.trim()).then(onDone))}>
        <input type="text" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
        <div className="actions">
          <button type="button" className="btn ghost" onClick={onClose}>
            <Az>Ləğv et</Az>
          </button>
          <button type="submit" className="btn primary" disabled={!title.trim()}>
            <Az ru="Создать">Yarat</Az>
          </button>
        </div>
      </form>
    </Sheet>
  );
}

// ---------------- режим «Разбор» ----------------

function Triage() {
  const { notes } = useData();
  // очередь фиксируем при входе: разобранное уходит, новое не вмешивается
  const [queue] = useState(() => notes.filter(isOpen).map((n) => n.id));
  const [pos, setPos] = useState(0);
  const [picking, setPicking] = useState(false);
  const [earned, setEarned] = useState(0);
  const byId = new Map(notes.map((n) => [n.id, n]));
  // пропускаем уже разобранные (например, на другом устройстве)
  let i = pos;
  while (i < queue.length && !(byId.get(queue[i]) && isOpen(byId.get(queue[i])!))) i++;
  const n = i < queue.length ? byId.get(queue[i]) : undefined;
  const next = (xp = true) => {
    if (xp) setEarned((e) => e + NOTE_XP);
    setPos(i + 1);
  };

  if (!n) {
    return (
      <div className="triage done-screen">
        <Buta className="rank-up-buta" />
        <h1>
          <Az ru="Всё разобрано!">Hamısı səliqəlidir!</Az>
        </h1>
        {earned > 0 && <p className="xp-big">+{earned} XP</p>}
        <button className="btn primary" onClick={() => (location.hash = 'inbox')}>
          <Az ru="К избранному">Saxlanılanlara</Az>
        </button>
      </div>
    );
  }

  return (
    <div className="triage">
      <div className="triage-top">
        <button className="btn ghost" onClick={() => (location.hash = 'inbox')}>
          <span className="ico">{Icon.back}</span> <Az>Geri</Az>
        </button>
        <span className="triage-count">
          {Math.min(i + 1, queue.length)} / {queue.length}
        </span>
      </div>
      <div className="bar triage-bar">
        <i style={{ width: `${(i / queue.length) * 100}%` }} />
      </div>
      <div className="triage-card">
        <div className="hint">{dayLabel(toDay(new Date(n.createdAt))).ru}</div>
        {n.images.length > 0 && (
          <div className="bubble-imgs n1">
            {n.images.map((h) => (
              <NoteImage key={h} hash={h} />
            ))}
          </div>
        )}
        <div className="triage-text">
          {pieces(n.text).map((p, k) =>
            p.kind === 'url' ? (
              <a key={k} href={p.text.startsWith('http') ? p.text : `https://${p.text}`} target="_blank" rel="noreferrer">
                {p.text}
              </a>
            ) : (
              <span key={k} className={p.kind === 'tag' ? 'tag' : undefined}>
                {p.text}
              </span>
            ),
          )}
        </div>
      </div>
      <div className="triage-actions">
        <button className="btn primary" onClick={() => void noteToTaskOp(n).then(() => next())}>
          → <Az ru="В задачу">Tapşırığa</Az>
        </button>
        <button className="btn" onClick={() => setPicking(true)}>
          → <Az ru="В проект">Layihəyə</Az>
        </button>
        <button className="btn green" onClick={() => void keepNote(n).then(() => next())}>
          <Az ru="Оставить">Saxla</Az>
        </button>
        <button className="btn danger" onClick={() => void remove('notes', n.id).then(() => next(false))}>
          <Az>Sil</Az>
        </button>
      </div>
      <p className="hint" style={{ textAlign: 'center' }}>
        +{NOTE_XP} XP за каждое разобранное ·{' '}
        <Az ru="«Оставить» — сообщение остаётся в избранном, но больше не просит разбора" full>
          «Saxla» — qalır, amma artıq baxılmış sayılır
        </Az>
      </p>
      {picking && <ProjectPicker note={n} onClose={() => setPicking(false)} onMoved={() => next()} />}
    </div>
  );
}
