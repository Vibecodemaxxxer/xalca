import { useEffect, type CSSProperties } from 'react';
import { EVENTS } from '../events';
import { findRun, pastRuns, visibleRuns } from '../events/runtime';
import type { EventRun } from '../events/types';
import { finishEndedEvents, joinEvent } from '../domain/ops';
import { Az } from '../i18n/Az';
import { addDays, diffDays, today, type Day } from '../lib/date';
import { Bar, Icon } from './common';
import { useData } from './data';
import { dayLabel } from './fmt';
import { RoutineRow } from './Rows';

const theme = (run: EventRun) => ({ '--ev': run.def.color, '--ev-accent': run.def.accent }) as CSSProperties;

function statusText(run: EventRun, t: Day): { az: string; ru: string } {
  if (run.status === 'upcoming') {
    const n = diffDays(t, run.start);
    return { az: `${n} gün sonra başlayır`, ru: `Начнётся через ${n} дн.` };
  }
  if (run.status === 'active') {
    const n = diffDays(t, run.end) + 1;
    return { az: `${n} gün qalıb`, ru: `Осталось дней: ${n}` };
  }
  return run.earned ? { az: 'Nişan qazanıldı!', ru: 'Значок получен!' } : { az: 'İvent bitdi', ru: 'Ивент завершён' };
}

/** Плашки ивентов на «Bu gün»: скоро начнутся, идут или только закончились. */
export function EventBanners() {
  const { routines, logs } = useData();
  const t = today();
  const runs = visibleRuns(EVENTS, t, routines, logs).filter((r) => r.joined || r.status !== 'finished');
  if (!runs.length) return null;
  return (
    <>
      {runs.map((run) => {
        const s = statusText(run, t);
        return (
          <div key={run.runId} className="event-banner" style={theme(run)} onClick={() => (location.hash = `event/${run.runId}`)}>
            <div className="ev-badge">{run.def.badge.icon()}</div>
            <div className="ev-body">
              <div className="ev-title">
                <Az ru={run.def.title.ru} full>
                  {run.def.title.az}
                </Az>
              </div>
              <div className="ev-sub">
                <Az ru={s.ru} full>
                  {s.az}
                </Az>
              </div>
              {run.joined && run.progress.total > 0 && <Bar cur={run.progress.done} target={run.progress.total} />}
            </div>
            {!run.joined && run.status !== 'finished' ? (
              <button
                className="btn ev-join"
                onClick={(e) => {
                  e.stopPropagation();
                  void joinEvent(run);
                }}
              >
                <Az>Qoşul</Az>
              </button>
            ) : (
              <span className="ico ev-go">{Icon.chevron}</span>
            )}
          </div>
        );
      })}
    </>
  );
}

/** Страница проведения ивента: общий каркас + собственное содержимое ивента. */
export function EventScreen({ runId }: { runId: string }) {
  const { routines, logs } = useData();
  const t = today();
  const run = findRun(EVENTS, runId, t, routines, logs);
  if (!run) {
    return (
      <div className="page-head">
        <h1>Ивент не найден</h1>
      </div>
    );
  }
  const s = statusText(run, t);
  const days: Day[] = [];
  for (let d = run.start; d <= run.end; d = addDays(d, 1)) days.push(d);
  const doneOn = (d: Day) => run.routines.length > 0 && run.routines.every((r) => run.logs.some((l) => l.routineId === r.id && l.date === d && l.done));
  const pct = run.progress.total ? Math.round((run.progress.done / run.progress.total) * 100) : 0;
  const { Page } = run.def;

  return (
    <div style={theme(run)}>
      <div className="event-hero">
        <button className="btn ghost back" onClick={() => history.back()}>
          <span className="ico">{Icon.back}</span> <Az>Geri</Az>
        </button>
        <div className="ev-hero-row">
          <div className="ev-badge big">{run.def.badge.icon()}</div>
          <div>
            <h1>
              <Az ru={run.def.title.ru} full>
                {run.def.title.az}
              </Az>
            </h1>
            <div className="ev-dates">
              <Az ru={`${dayLabel(run.start).ru} – ${dayLabel(run.end).ru}`} full>{`${dayLabel(run.start).az} – ${dayLabel(run.end).az}`}</Az>
              {' · '}
              <Az ru={s.ru} full>
                {s.az}
              </Az>
            </div>
          </div>
        </div>
        <p className="ev-intro">
          <Az ru={run.def.intro.ru} full>
            {run.def.intro.az}
          </Az>
        </p>
      </div>

      {!run.joined && run.status !== 'finished' && (
        <button className="btn primary" style={{ marginTop: 12 }} onClick={() => void joinEvent(run)}>
          <Az>Qoşul</Az>
        </button>
      )}

      {run.joined && (
        <>
          <section className="section">
            <h2>
              <Az ru="Прогресс">Tərəqqi</Az> <span className="count">· {pct}%</span>
            </h2>
            <Bar cur={run.progress.done} target={run.progress.total} />
            <p className="hint">
              {run.progress.done} из {run.progress.total} · для значка «{run.def.badge.title.ru}» нужно {Math.round(run.def.goal * 100)}%
              {run.earned && ' — получен ✓'}
            </p>
            <div className="ev-days">
              {days.map((d) => (
                <span key={d} className={`ev-day${d === t ? ' today' : ''}${d > t ? ' future' : doneOn(d) ? ' done' : ' miss'}`} title={dayLabel(d).ru}>
                  {Number(d.slice(8))}
                </span>
              ))}
            </div>
          </section>
          {run.status === 'active' && (
            <section className="section">
              <h2>
                <Az>Bu gün</Az>
              </h2>
              <div className="list">
                {run.routines.map((r) => (
                  <RoutineRow key={r.id} routine={r} day={t} log={run.logs.find((l) => l.routineId === r.id && l.date === t)} streak={0} onOpen={() => {}} />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {Page && (
        <section className="section ev-page">
          <Page run={run} />
        </section>
      )}
    </div>
  );
}

/** Значки за ивенты — в профиле. */
export function EventBadges() {
  const { routines, logs } = useData();
  const earned = pastRuns(EVENTS, today(), routines, logs).filter((r) => r.earned);
  if (!earned.length) return null;
  return (
    <section className="section">
      <h2>
        <Az ru="Значки">Nişanlar</Az>
      </h2>
      <div className="badges">
        {earned.map((r) => (
          <button key={r.runId} className="badge-item" style={theme(r)} onClick={() => (location.hash = `event/${r.runId}`)}>
            <span className="ev-badge">{r.def.badge.icon()}</span>
            <span>
              <Az ru={r.def.badge.title.ru} full>
                {r.def.badge.title.az}
              </Az>
            </span>
            <span className="hint">{r.start.slice(0, 4)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** Выключает привычки закончившихся ивентов. */
export function EventsWatcher() {
  const { routines, logs } = useData();
  const runs = pastRuns(EVENTS, today(), routines, logs);
  const pending = runs.some((r) => r.status === 'finished' && r.routines.some((x) => x.active));
  useEffect(() => {
    if (pending) void finishEndedEvents(routines, runs);
  }, [pending]);
  return null;
}
