import { useEffect, useRef, useState } from 'react';
import { getMeta, setMeta } from '../db/db';
import { knotLevel, rankFor, RANKS, semeniStage } from '../domain/xp';
import { Az } from '../i18n/Az';
import { addDays, daysInMonth, parseDay, toDay, today, type Day } from '../lib/date';
import { Bar, Buta, Icon, Sheet } from './common';
import { useData } from './data';
import { AbbasiAmount } from './Bazar';
import { EventBadges } from './Events';
import { dayLabel } from './fmt';

// ---------------- значок сословия ----------------

export function RankBadge() {
  const { xp, abbasi } = useData();
  const r = rankFor(xp.total);
  const todayXp = xp.byDay.get(today()) ?? 0;
  return (
    <button className="rank-badge" onClick={() => (location.hash = 'profile')} aria-label="Профиль">
      <Buta className="rb-buta" />
      <span className="rb-text">
        <span className="rb-name">
          <Az ru={r.rank.ru}>{r.rank.az}</Az>
        </span>
        <span className="rb-xp">
          {todayXp > 0 ? `+${todayXp} XP` : `${xp.total} XP`} · <AbbasiAmount n={abbasi.balance} size={11} />
        </span>
      </span>
      <i className="rb-bar" style={{ width: `${Math.round(r.progress * 100)}%` }} />
    </button>
  );
}

// ---------------- səməni ----------------

/** Росток səməni: растёт со стриком привычки, подвядает при пропуске. */
export function Semeni({ streak, everDone, size = 26 }: { streak: number; everDone: boolean; size?: number }) {
  const stage = semeniStage(streak, everDone);
  const wilted = stage === -1;
  const h = [0, 5, 9, 13, 17][Math.max(0, stage)] || (wilted ? 7 : 0);
  const blades = wilted ? 5 : [0, 3, 5, 7, 9][stage];
  const green = wilted ? '#a08a52' : '#4f8a3c';
  return (
    <svg className="semeni" width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      {Array.from({ length: blades }, (_, i) => {
        const x = 12 + (i - (blades - 1) / 2) * 2;
        const tilt = (i - (blades - 1) / 2) * (wilted ? 2.4 : 0.9);
        const top = 19 - h + Math.abs(i - (blades - 1) / 2) * 0.8;
        return wilted ? (
          <path key={i} d={`M${x} 19 Q${x} ${top} ${x + tilt + 3} ${top + 4}`} stroke={green} strokeWidth="1.3" fill="none" strokeLinecap="round" />
        ) : (
          <path key={i} d={`M${x} 19 Q${x + tilt * 0.4} ${top + 3} ${x + tilt} ${top}`} stroke={green} strokeWidth="1.4" fill="none" strokeLinecap="round" />
        );
      })}
      {stage === 0 && [8, 11, 14, 16].map((x) => <circle key={x} cx={x} cy={18.2} r=".9" fill="#c8902e" />)}
      {stage >= 4 && <path d="M7.5 15.5 h9" stroke="#b0302a" strokeWidth="1.6" strokeLinecap="round" />}
      <path d="M4.5 19 h15 l-1.6 3 h-11.8z" fill="#c8902e" />
    </svg>
  );
}

// ---------------- ковёр ----------------

const FIELD = '#6e1a26';
const COLORS = ['#c8902e', '#f6efe3', '#2b4f7e', '#c8902e'];

/**
 * Ковёр месяца, лежит горизонтально: столбец — день, богатство узора — опыт за день,
 * пропуск — голые нити основы, будущие дни ещё не сотканы.
 */
export function Carpet({ month, onPick, picked }: { month: Day; onPick?: (d: Day) => void; picked?: Day }) {
  const { xp } = useData();
  const m = parseDay(month);
  const n = daysInMonth(m.getFullYear(), m.getMonth());
  const t = today();
  const COL = 10;
  const B = 12; // кайма
  const FH = 104; // высота поля
  const W = n * COL + B * 2;
  const H = FH + B * 2;

  const cols = Array.from({ length: n }, (_, i) => {
    const d = toDay(new Date(m.getFullYear(), m.getMonth(), i + 1));
    return { d, xp: xp.byDay.get(d) ?? 0, future: d > t };
  });

  return (
    <svg className="carpet" viewBox={`-8 0 ${W + 16} ${H}`} role="img" aria-label="Ковёр месяца">
      {/* бахрома по коротким краям */}
      {Array.from({ length: 16 }, (_, i) => {
        const y = B + 4 + i * ((FH - 8) / 15);
        return (
          <g key={i} stroke="#d9c7a6" strokeWidth="1">
            <line x1={-8} y1={y} x2={1} y2={y} />
            <line x1={W - 1} y1={y} x2={W + 8} y2={y} />
          </g>
        );
      })}
      <rect x="0" y="0" width={W} height={H} rx="3" fill="#2b4f7e" />
      <rect x="3.5" y="3.5" width={W - 7} height={H - 7} fill="none" stroke="#c8902e" strokeWidth="1.6" />
      {Array.from({ length: Math.floor((W - 12) / 10) }, (_, i) => (
        <g key={i} fill="#c8902e">
          <path d={`M${9 + i * 10} 6l2.5 2.5-2.5 2.5-2.5-2.5z`} />
          <path d={`M${9 + i * 10} ${H - 11}l2.5 2.5-2.5 2.5-2.5-2.5z`} />
        </g>
      ))}
      <rect x={B} y={B} width={n * COL} height={FH} fill={FIELD} />
      {cols.map((c, i) => {
        const x = B + i * COL;
        const lvl = c.future ? -1 : knotLevel(c.xp);
        const motifs = lvl > 0 ? lvl * 2 : 0;
        return (
          <g key={c.d} className={`crow${picked === c.d ? ' picked' : ''}`} onClick={() => onPick?.(c.d)}>
            <title>{`${dayLabel(c.d).ru}: ${c.xp} XP`}</title>
            <rect x={x} y={B} width={COL} height={FH} fill="transparent" />
            {lvl === -1 && <rect x={x} y={B} width={COL} height={FH} fill="#3a1016" opacity=".55" />}
            {lvl === 0 && (
              <>
                <rect x={x} y={B} width={COL} height={FH} fill="#f6efe3" opacity=".92" />
                {Array.from({ length: 13 }, (_, k) => (
                  <line key={k} x1={x} y1={B + 4 + k * 8} x2={x + COL} y2={B + 4 + k * 8} stroke="#c9b48f" strokeWidth=".6" />
                ))}
              </>
            )}
            {lvl > 0 &&
              Array.from({ length: motifs }, (_, k) => {
                const cy = B + (FH / (motifs + 1)) * (k + 1);
                const cx = x + COL / 2;
                return lvl === 4 && k === Math.floor(motifs / 2) - 1 ? (
                  <path key={k} d={`M${cx + 2.5} ${cy - 3.5}c-1.6.8-4 1.6-4 4 0 1.6 1.6 2.4 2.4 2.4 1.6 0 2.4-.8 2.4-2.4 0-.8-.8-1.6-1.6-.8`} fill="none" stroke="#f6efe3" strokeWidth=".9" />
                ) : (
                  <path key={k} d={`M${cx} ${cy - 3.5}l3.5 3.5-3.5 3.5-3.5-3.5z`} fill={COLORS[(k + i) % COLORS.length]} opacity={0.55 + lvl * 0.11} />
                );
              })}
            {lvl >= 2 && <line x1={x + 0.5} y1={B} x2={x + 0.5} y2={B + FH} stroke="#c8902e" strokeWidth=".5" opacity=".5" />}
            {picked === c.d && <rect x={x + 0.5} y={B + 0.5} width={COL - 1} height={FH - 1} fill="none" stroke="#fff" strokeWidth="1.2" />}
          </g>
        );
      })}
    </svg>
  );
}

// ---------------- профиль ----------------

export function ProfileScreen() {
  const { xp, abbasi } = useData();
  const r = rankFor(xp.total);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6));
  const weekXp = week.reduce((a, d) => a + (xp.byDay.get(d) ?? 0), 0);
  const activeDays = [...xp.byDay.values()].filter((v) => v > 0).length;

  return (
    <>
      <div className="page-head">
        <h1>
          <Az ru="Профиль">Profil</Az>
        </h1>
        <button className="btn" onClick={() => (location.hash = 'settings')} aria-label="Настройки">
          <span className="ico">{Icon.settings}</span> <Az>Ayarlar</Az>
        </button>
      </div>

      <div className="card rank-card">
        <Buta className="rank-buta" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="hint">
            <Az>Rütbə</Az>
          </div>
          <div className="rank-name">
            <Az ru={r.rank.ru}>{r.rank.az}</Az>
          </div>
          <div className="hint">{r.rank.about}</div>
          <Bar cur={r.progress * 100} target={100} />
          <div className="hint" style={{ marginTop: 4 }}>
            {xp.total} XP
            {r.next && (
              <>
                {' '}
                · до «<Az ru={r.next.ru}>{r.next.az}</Az>» {r.toNext}
              </>
            )}
          </div>
        </div>
      </div>

      <button className="card bazar-link" onClick={() => (location.hash = 'bazar')}>
        <AbbasiAmount n={abbasi.balance} size={30} />
        <span>
          <Az ru="Рынок наград — потратить abbası">Bazar</Az>
        </span>
        <span className="ico">{Icon.chevron}</span>
      </button>

      <div className="stats">
        <div className="stat">
          <b>{xp.byDay.get(today()) ?? 0}</b>
          <span>
            <Az>Bu gün</Az>
          </span>
        </div>
        <div className="stat">
          <b>{weekXp}</b>
          <span>7 gün</span>
        </div>
        <div className="stat">
          <b>{activeDays}</b>
          <span>
            <Az ru="Активных дней">Aktiv günlər</Az>
          </span>
        </div>
      </div>

      <section className="section">
        <h2>
          <Az ru="Путь по сословиям">Yol</Az>
        </h2>
        <ol className="ranks">
          {RANKS.map((x, i) => (
            <li key={x.az} className={i < r.index ? 'past' : i === r.index ? 'cur' : ''}>
              <span className="rk-dot">{i <= r.index ? '◆' : '◇'}</span>
              <span className="rk-name">
                <Az ru={x.ru}>{x.az}</Az>
              </span>
              <span className="rk-about">{x.about}</span>
              <span className="rk-xp">{x.xp}</span>
            </li>
          ))}
        </ol>
      </section>
      <EventBadges />

    </>
  );
}

// ---------------- праздник повышения и всплывающие +XP ----------------

export function GameWatcher() {
  const { xp } = useData();
  const [rankUp, setRankUp] = useState<number | null>(null);
  const [toast, setToast] = useState<{ n: number; key: number } | null>(null);
  const prevTotal = useRef<number | null>(null);

  useEffect(() => {
    const prev = prevTotal.current;
    prevTotal.current = xp.total;
    // Прирост за одно действие пользователя. Первый рендер и большие скачки (история пришла синком
    // с другого устройства) — не «заработано сейчас»: без всплывашки и без праздника.
    const earned = prev != null && xp.total > prev && xp.total - prev <= 200 ? xp.total - prev : 0;
    const index = rankFor(xp.total).index;

    void (async () => {
      const seen = await getMeta<number>('rank.seen');
      if (earned && seen != null && index > seen) setRankUp(index);
      else if (seen !== index) await setMeta('rank.seen', index);
    })();

    if (!earned) return;
    setToast({ n: earned, key: Date.now() });
    const t = setTimeout(() => setToast(null), 1400);
    return () => clearTimeout(t);
  }, [xp.total]);

  return (
    <>
      {toast && (
        <div key={toast.key} className="xp-toast">
          +{toast.n} XP
        </div>
      )}
      {rankUp != null && (
        <Sheet
          title={<Az ru="Поздравляем!">Təbriklər!</Az>}
          onClose={() => {
            void setMeta('rank.seen', rankUp);
            setRankUp(null);
          }}
        >
          <div className="rank-up">
            <Buta className="rank-up-buta" />
            <div className="hint">
              <Az ru="Новое сословие">Yeni rütbə</Az>
            </div>
            <div className="rank-name big">
              <Az ru={RANKS[rankUp].ru}>{RANKS[rankUp].az}</Az>
            </div>
            <p>{RANKS[rankUp].about}</p>
            <button
              className="btn primary"
              onClick={() => {
                void setMeta('rank.seen', rankUp);
                setRankUp(null);
              }}
            >
              <Az ru="Дальше">Davam et</Az>
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}
