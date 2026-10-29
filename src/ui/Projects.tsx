import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Project, Task } from '../db/types';
import { projectProgress } from '../domain/tree';
import { projectBonus } from '../domain/xp';
import { Az } from '../i18n/Az';
import { Bar, Empty, Icon, Section } from './common';
import { QuickInput } from './TaskCard';
import { TaskTree } from './TaskTree';
import { useData } from './data';
import { ProjectSheet, TaskSheet } from './Editors';
import { RichEditor } from './Markdown';
import { update } from '../db/db';


export function ProjectsScreen({ openId }: { openId?: string }) {
  const { projectById } = useData();
  const project = openId ? projectById.get(openId) : undefined;
  return project ? <ProjectView project={project} /> : <ProjectList />;
}

function ProjectList() {
  const { projects, tasks } = useData();
  const [creating, setCreating] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const active = projects.filter((p) => !p.archived && !p.completedAt).sort((a, b) => a.createdAt - b.createdAt);
  const archived = projects.filter((p) => p.archived && !p.completedAt);
  const completed = projects.filter((p) => p.completedAt).sort((a, b) => (b.completedAt ?? 0) - (a.completedAt ?? 0));

  const card = (p: Project) => {
    const pr = projectProgress(p.id, tasks);
    return (
      <button key={p.id} className="project-card" onClick={() => (location.hash = `projects/${p.id}`)} style={{ '--pc': p.color } as CSSProperties}>
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
      {completed.length > 0 && (
        <Section title="Tamamlanmış layihələr" count={completed.length}>
          <div className="project-grid">{completed.map(card)}</div>
        </Section>
      )}
      {showArchive && (
        <Section title="Arxiv">
          <div className="project-grid">{archived.map(card)}</div>
        </Section>
      )}
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
  const roots = (children.get('') ?? []).filter((t) => t.projectId === p.id);
  const pr = projectProgress(p.id, tasks);
  const allDone = pr.total > 0 && pr.done === pr.total;
  const bonus = projectBonus(p.id, tasks);



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
      {p.completedAt ? (
        <div className="project-done">
          <span>
            ✓ <Az ru="Проект завершён">Layihə tamamlandı</Az> · +{bonus} XP
          </span>
          <button className="btn small" onClick={() => void update<Project>('projects', p.id, { completedAt: null })}>
            <Az ru="Вернуть в работу">Geri qaytar</Az>
          </button>
        </div>
      ) : (
        allDone && (
          <div className="project-done">
            <span>
              <Az ru="Все задачи выполнены! Заверши проект и получи бонус — половину наград за его задачи.">Bütün tapşırıqlar hazırdır!</Az>
            </span>
            <button className="btn gold" onClick={() => void update<Project>('projects', p.id, { completedAt: Date.now() })}>
              <Az>Layihəni tamamla</Az> +{bonus}
            </button>
          </div>
        )
      )}
      <div className="project-desc">
        <ProjectNotes project={p} />
      </div>

      <div style={{ marginTop: 14 }}>
        <QuickInput defaults={{ projectId: p.id }} />
      </div>

      <TaskTree items={roots} onOpen={(task) => setOpen({ task })} />
      {!roots.length && <Empty az="Tapşırıq yoxdur" ru="Задач нет — добавь первую строкой выше" />}

      {editing && <ProjectSheet project={p} onClose={() => setEditing(false)} />}
      {open && <TaskSheet task={open.task} defaults={open.defaults} onClose={() => setOpen(null)} />}
    </>
  );
}

/** Заметки проекта прямо на странице: редактируются как в Notion, сохраняются сами. */
function ProjectNotes({ project: p }: { project: Project }) {
  const [text, setText] = useState(p.description);
  const pending = useRef<string | null>(null);
  const flush = () => {
    if (pending.current != null) void update<Project>('projects', p.id, { description: pending.current });
    pending.current = null;
  };
  useEffect(() => {
    if (text === p.description) return;
    pending.current = text;
    const t = setTimeout(flush, 600);
    return () => clearTimeout(t);
  }, [text]);
  // уходим со страницы — сохраняем недописанное
  useEffect(() => () => flush(), []);
  return <RichEditor value={p.description} onChange={setText} placeholder="Заметки, план, ссылки…" />;
}
