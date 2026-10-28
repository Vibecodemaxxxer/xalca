import { useState, type CSSProperties } from 'react';
import { tr } from '../i18n/lang';
import type { Project, Task } from '../db/types';
import { newTask, setTaskDone } from '../domain/ops';
import { projectProgress, taskProgress } from '../domain/tree';
import { Az } from '../i18n/Az';
import { Bar, Check, Empty, Icon, Section } from './common';
import { useData } from './data';
import { QuoteCard } from './Quote';
import { ProjectSheet, QuickSub, TaskSheet } from './Editors';
import { Markdown } from './Markdown';
import { dayLabel } from './fmt';
import { update } from '../db/db';

// Свёрнутые ветки дерева запоминаются на устройстве.
const COLLAPSED = 'xalca.collapsed';
function loadCollapsed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSED) ?? '[]'));
  } catch {
    return new Set();
  }
}

export function ProjectsScreen({ openId }: { openId?: string }) {
  const { projectById } = useData();
  const project = openId ? projectById.get(openId) : undefined;
  return project ? <ProjectView project={project} /> : <ProjectList />;
}

function ProjectList() {
  const { projects, tasks } = useData();
  const [creating, setCreating] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const active = projects.filter((p) => !p.archived).sort((a, b) => a.createdAt - b.createdAt);
  const archived = projects.filter((p) => p.archived);

  const card = (p: Project) => {
    const pr = projectProgress(p.id, tasks);
    return (
      <button key={p.id} className="project-card" onClick={() => (location.hash = `projects/${p.id}`)} style={{ borderLeftColor: p.color }}>
        <div className="title">{p.title}</div>
        <div className="meta">
          {pr.total ? `${pr.done}/${pr.total}` : <Az>Tapşırıq yoxdur</Az>}
          {pr.total > 0 && pr.done === pr.total && <span className="streak"> ✓</span>}
        </div>
        {pr.total > 0 && <Bar cur={pr.done} target={pr.total} />}
      </button>
    );
  };

  return (
    <>
      <div className="page-head">
        <h1>
          <Az>Layihələr</Az>
        </h1>
        {archived.length > 0 && (
          <button className="btn ghost" onClick={() => setShowArchive(!showArchive)}>
            <Az>Arxiv</Az> · {archived.length}
          </button>
        )}
      </div>
      {!active.length && <Empty az="Hələ layihə yoxdur" />}
      <div className="project-grid">{active.map(card)}</div>
      {showArchive && (
        <Section title="Arxiv">
          <div className="project-grid">{archived.map(card)}</div>
        </Section>
      )}
      <QuoteCard place="projects" />
      <button className="fab" aria-label="Новый проект" onClick={() => setCreating(true)}>
        {Icon.plus}
      </button>
      {creating && <ProjectSheet onClose={() => setCreating(false)} onCreated={(p) => (location.hash = `projects/${p.id}`)} />}
    </>
  );
}

function ProjectView({ project: p }: { project: Project }) {
  const { tasks, children } = useData();
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState<{ task?: Task; defaults?: Partial<Task> } | null>(null);
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const [text, setText] = useState('');
  const roots = (children.get('') ?? []).filter((t) => t.projectId === p.id);
  const pr = projectProgress(p.id, tasks);

  const toggle = (id: string) => {
    const next = new Set(collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setCollapsed(next);
    try {
      localStorage.setItem(COLLAPSED, JSON.stringify([...next]));
    } catch {
      /* приватный режим — просто не запоминаем */
    }
  };

  const add = async () => {
    if (!text.trim()) return;
    await newTask({ title: text.trim(), projectId: p.id });
    setText('');
  };

  return (
    <>
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <button className="btn ghost back" onClick={() => (location.hash = 'projects')}>
            <span className="ico">{Icon.back}</span> <Az>Layihələr</Az>
          </button>
          <h1 className="project-title" style={{ '--pc': p.color } as CSSProperties} onClick={() => setEditing(true)}>
            {p.title}
          </h1>
          <div className="sub">
            {pr.total ? `${pr.done}/${pr.total} · ${Math.round((pr.done / pr.total) * 100)}%` : ''}
            {p.archived && (
              <>
                {' '}
                · <Az>Arxiv</Az>
              </>
            )}
          </div>
        </div>
        <button className="btn ghost" onClick={() => setEditing(true)}>
          <Az>Redaktə</Az>
        </button>
      </div>
      {pr.total > 0 && <Bar cur={pr.done} target={pr.total} />}
      {p.description.trim() && (
        <div className="card project-desc">
          <Markdown source={p.description} onChange={(md) => void update<Project>('projects', p.id, { description: md })} />
        </div>
      )}

      <form className="quick" onSubmit={(e) => (e.preventDefault(), add())} style={{ marginTop: 14 }}>
        <input type="text" placeholder={tr('+ Yeni tapşırıq…', '+ Новая задача…')} value={text} onChange={(e) => setText(e.target.value)} />
      </form>

      <div className="tree">
        {roots.map((t) => (
          <TreeNode key={t.id} task={t} depth={0} collapsed={collapsed} onToggle={toggle} onOpen={(task) => setOpen({ task })} />
        ))}
      </div>
      {!roots.length && <Empty az="Tapşırıq yoxdur" ru="Задач нет — добавь первую строкой выше" />}

      {editing && <ProjectSheet project={p} onClose={() => setEditing(false)} />}
      {open && <TaskSheet task={open.task} defaults={open.defaults} onClose={() => setOpen(null)} />}
    </>
  );
}

function TreeNode({ task: t, depth, collapsed, onToggle, onOpen }: { task: Task; depth: number; collapsed: Set<string>; onToggle: (id: string) => void; onOpen: (t: Task) => void }) {
  const { children } = useData();
  const [adding, setAdding] = useState(false);
  const kids = children.get(t.id) ?? [];
  const isCollapsed = collapsed.has(t.id);
  const done = t.status === 'done';
  const p = taskProgress(t, children);
  const d = t.date ? dayLabel(t.date) : null;

  return (
    <div className="node" style={{ '--depth': depth } as CSSProperties}>
      <div className={`row tree-row${done ? ' done' : ''}`}>
        <button className={`twist${kids.length ? '' : ' none'}${isCollapsed ? '' : ' open'}`} onClick={() => kids.length && onToggle(t.id)} aria-label={isCollapsed ? 'Развернуть' : 'Свернуть'}>
          {Icon.chevron}
        </button>
        <Check on={done} onToggle={() => setTaskDone(t, !done)} />
        <div className="body" onClick={() => onOpen(t)}>
          <div className="title">{t.title}</div>
          {(p?.total || d || t.description.trim()) && (
            <div className="meta">
              {p && p.total > 0 && (
                <span>
                  {p.done}/{p.total}
                  {p.total > 0 && t.metric.type === 'number' && t.metric.unit ? ` ${t.metric.unit}` : ''}
                </span>
              )}
              {d && (
                <span>
                  <Az ru={d.ru}>{d.az}</Az>
                </span>
              )}
              {t.description.trim() && <span className="chip ico">{t.images.length ? Icon.image : Icon.note}</span>}
            </div>
          )}
          {p && p.total > 0 && <Bar cur={p.done} target={p.total} />}
        </div>
        <button className="add-sub" onClick={() => setAdding(true)} aria-label="Добавить подзадачу">
          +
        </button>
      </div>
      {adding && (
        <div className="node" style={{ '--depth': depth + 1 } as CSSProperties}>
          <QuickSub parent={t} autoFocus onDone={() => setAdding(false)} />
        </div>
      )}
      {!isCollapsed && kids.map((k) => <TreeNode key={k.id} task={k} depth={depth + 1} collapsed={collapsed} onToggle={onToggle} onOpen={onOpen} />)}
    </div>
  );
}
