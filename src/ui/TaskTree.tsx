import { useState } from 'react';
import type { Task } from '../db/types';
import { saveTask, setTaskDone } from '../domain/ops';
import { descendants, taskProgress } from '../domain/tree';
import { Az } from '../i18n/Az';
import { today } from '../lib/date';
import { Check, Icon } from './common';
import { useData } from './data';
import { EmojiPicker } from './emoji';
import { dayLabel } from './fmt';
import { SubAdd } from './TaskCard';

// Дерево задач с линиями-направляющими (как в Notion/Workflowy).
// Глубокие ветки по умолчанию свёрнуты; что раскрыто — запоминается на устройстве.

const KEY = 'xalca.tree';
function loadOpen(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '{}');
  } catch {
    return {};
  }
}
let openState = loadOpen();
const isOpenNode = (id: string, depth: number) => openState[id] ?? depth < 1;
function setOpenNode(id: string, v: boolean) {
  openState = { ...openState, [id]: v };
  try {
    localStorage.setItem(KEY, JSON.stringify(openState));
  } catch {
    /* не запоминаем */
  }
}

export function TaskTree({ items, onOpen, depth = 0 }: { items: Task[]; onOpen: (t: Task) => void; depth?: number }) {
  return (
    <div className={depth ? 'tt-children' : 'tt'}>
      {items.map((t) => (
        <TreeNode key={t.id} task={t} depth={depth} onOpen={onOpen} />
      ))}
    </div>
  );
}

function TreeNode({ task: t, depth, onOpen }: { task: Task; depth: number; onOpen: (t: Task) => void }) {
  const { children } = useData();
  const [open, setOpen] = useState(() => isOpenNode(t.id, depth));
  const [adding, setAdding] = useState(false);
  const [emoji, setEmoji] = useState(false);
  const kids = children.get(t.id) ?? [];
  const done = t.status === 'done';
  const p = taskProgress(t, children);
  const all = kids.length ? descendants(t.id, children) : [];
  const d = t.date ? dayLabel(t.date) : null;
  const late = !done && !!t.date && t.date < today();

  const toggle = () => {
    setOpen(!open);
    setOpenNode(t.id, !open);
  };

  return (
    <div className="tt-node">
      <div className={`tt-row${done ? ' done' : ''}${depth >= 2 ? ' deep' : ''}`}>
        <button className={`twist${kids.length ? '' : ' none'}${open ? ' open' : ''}`} onClick={toggle} aria-label={open ? 'Свернуть' : 'Развернуть'}>
          {Icon.chevron}
        </button>
        <Check on={done} onToggle={() => void setTaskDone(t, !done)} />
        {t.icon && (
          <button className="tt-emoji" onClick={() => setEmoji(true)}>
            {t.icon}
          </button>
        )}
        <div className="tt-body" onClick={() => onOpen(t)}>
          <span className="tt-title">{t.title}</span>
          {(d || (kids.length > 0 && (!open || p?.total))) && (
            <span className="tt-meta">
              {kids.length > 0 && (
                <span className="tt-count">
                  {all.filter((x) => x.status === 'done').length}/{all.length}
                </span>
              )}
              {d && (
                <span className={late ? 'late' : ''}>
                  <Az ru={d.ru} full>
                    {d.az}
                  </Az>
                </span>
              )}
            </span>
          )}
        </div>
        {/* плюс нарисован в CSS — строго по центру кнопки */}
        <button className="add-sub" onClick={() => (setAdding(true), !open && toggle())} aria-label="Добавить подзадачу" />

      </div>
      {(open || adding) && (kids.length > 0 || adding) && (
        <div className="tt-children">
          {open && kids.map((k) => <TreeNode key={k.id} task={k} depth={depth + 1} onOpen={onOpen} />)}
          {adding && <SubAdd parent={t} autoFocus onDone={() => setAdding(false)} />}
        </div>
      )}
      {emoji && <EmojiPicker value={t.icon} onPick={(e) => void saveTask(t.id, { icon: e })} onClose={() => setEmoji(false)} />}
    </div>
  );
}
