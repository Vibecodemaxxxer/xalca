import { useEffect, useRef, useState } from 'react';
import { getMeta, setMeta } from '../db/db';
import { knotLevel, rankFor, RANKS, semeniStage } from '../domain/xp';
import { Az } from '../i18n/Az';
import { addDays, daysInMonth, parseDay, toDay, today, type Day } from '../lib/date';
import { Bar, Buta, Icon, Sheet } from './common';
import { useData } from './data';
import { AZ_MONTHS, dayLabel, RU_MONTHS_NOM } from './fmt';

// ---------------- значок сословия ----------------

export function RankBadge() {
  const { xp } = useData();
  const r = rankFor(xp.total);
  const todayXp = xp.byDay.get(today()) ?? 0;
  return (
    <button className="rank-badge" onClick={() => (location.hash = 'profile')} aria-label="Профиль">
      <Buta className="rb-buta" />
      <span className="rb-text">
        <span className="rb-name">
          <Az ru={r.rank.ru}>{r.rank.az}</Az>
        </span>
        <span className="rb-xp">{todayXp > 0 ? `+${todayXp} XP` : `${xp.total} XP`}</span>
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

/** Ковёр месяца: ряд — день, богатство узора — опыт за день, пропуск — голые нити основы. */
export function Carpet({ month, onPick, picked }: { month: Day; onPick?: (d: Day) => void; picked?: Day }) {
  const { xp } = useData();
  const m = parseDay(month);
  const n = daysInMonth(m.getFullYear(), m.getMonth());
  const t = today();
  const W = 200;
  const ROW = 11;
  const B = 14; // кайма
  const H = n * ROW + B * 2;
  const inner = W - B * 2;

  const rows = Array.from({ length: n }, (_, i) => {
    const d = toDay(new Date(m.getFullYear(), m.getMonth(), i + 1));
    return { d, xp: xp.byDay.get(d) ?? 0, future: d > t };
  });

  return (
    <svg className="carpet" viewBox={`0 -6 ${W} ${H + 12}`} role="img" aria-label="Ковёр месяца">
      {/* бахрома */}
      {Array.from({ length: 24 }, (_, i) => (
        <g key={i} stroke="#d9c7a6" strokeWidth="1">
          <line x1={B + 4 + i * ((inner - 8) / 23)} y1={-6} x2={B + 4 + i * ((inner - 8) / 23)} y2={1} />
          <line x1={B + 4 + i * ((inner - 8) / 23)} y1={H - 1} x2={B + 4 + i * ((inner - 8) / 23)} y2={H + 6} />
        </g>
      ))}
      {/* кайма */}
      <rect x="0" y="0" width={W} height={H} rx="3" fill="#2b4f7e" />
      <rect x="4" y="4" width={W - 8} height={H - 8} fill="none" stroke="#c8902e" strokeWidth="2" />
      {Array.from({ length: Math.floor((H - 16) / 10) }, (_, i) => (
        <g key={i} fill="#c8902e">
          <path d={`M7 ${10 + i * 10} l3 -3 l3 3 l-3 3z`} />
          <path d={`M${W - 13} ${10 + i * 10} l3 -3 l3 3 l-3 3z`} />
        </g>
      ))}
      {/* поле */}
      <rect x={B} y={B} width={inner} height={n * ROW} fill={FIELD} />
      {rows.map((r, i) => {
        const y = B + i * ROW;
        const lvl = r.future ? -1 : knotLevel(r.xp);
        const motifs = lvl > 0 ? lvl * 2 : 0;
        return (
          <g key={r.d} className={`crow${picked === r.d ? ' picked' : ''}`} onClick={() => onPick?.(r.d)}>
            <title>{`${dayLabel(r.d).ru}: ${r.xp} XP`}</title>
            {lvl === -1 && <rect x={B} y={y} width={inner} height={ROW} fill="#3a1016" opacity=".55" />}
            {lvl === 0 && (
              <>
                <rect x={B} y={y} width={inner} height={ROW} fill="#f6efe3" opacity=".9" />
                {Array.from({ length: 34 }, (_, k) => (
                  <line key={k} x1={B + 2 + k * (inner / 34)} y1={y} x2={B + 2 + k * (inner / 34)} y2={y + ROW} stroke="#c9b48f" strokeWidth=".6" />
                ))}
              </>
            )}
            {lvl > 0 &&
              Array.from({ length: motifs }, (_, k) => {
                const cx = B + (inner / (motifs + 1)) * (k + 1);
                const cy = y + ROW / 2;
                const c = COLORS[(k + i) % COLORS.length];
                return lvl === 4 && k === Math.floor(motifs / 2) - 1 ? (
                  <path key={k} d={`M${cx + 3} ${cy - 4} c-2 1 -5 2 -5 5 c0 2 2 3 3 3 c2 0 3 -1 3 -3 c0 -1 -1 -2 -2 -1`} fill="none" stroke="#f6efe3" strokeWidth="1.1" />
                ) : (
                  <path key={k} d={`M${cx} ${cy - 4} l4 4 l-4 4 l-4 -4z`} fill={c} opacity={0.55 + lvl * 0.11} />
                );
              })}
            {lvl >= 2 && <line x1={B} y1={y + 0.5} x2={B + inner} y2={y + 0.5} stroke="#c8902e" strokeWidth=".5" opacity=".5" />}
            {picked === r.d && <rect x={B} y={y} width={inner} height={ROW} fill="none" stroke="#fff" strokeWidth="1" />}
          </g>
        );
      })}
    </svg>
  );
}

// ---------------- профиль ----------------

export function ProfileScreen() {
  const { xp } = useData();
  const r = rankFor(xp.total);
  const [month, setMonth] = useState(() => today().slice(0, 8) + '01');
  const [picked, setPicked] = useState<Day | undefined>();
  const m = parseDay(month);
  const monthXp = [...xp.byDay].filter(([d]) => d.startsWith(month.slice(0, 7))).reduce((a, [, v]) => a + v, 0);
  const firstMonth = [...xp.byDay.keys()].sort()[0]?.slice(0, 8) + '01';
  const canBack = !!firstMonth && month > firstMonth;
  const canFwd = month < today().slice(0, 8) + '01';
  const shiftMonth = (k: number) => {
    const d = new Date(m.getFullYear(), m.getMonth() + k, 1);
    setMonth(toDay(d));
    setPicked(undefined);
  };

  const week = Array.from({ length: 7 }, (_, i) => addDays(today(), i - 6));
  const weekXp = week.reduce((a, d) => a + (xp.byDay.get(d) ?? 0), 0);
  const activeDays = [...xp.byDay.values()].filter((v) => v > 0).length;

  return (
    <>
      <div className="page-head">
        <h1>
          <Az ru="Профиль">Profil</Az>
        </h1>
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
          <Az ru="Ковёр месяца">Ayın xalçası</Az>
        </h2>
        <div className="carpet-wrap">
          <div className="cal-nav">
            <button className="btn ghost" disabled={!canBack} onClick={() => shiftMonth(-1)} aria-label="Предыдущий месяц">
              <span className="ico">{Icon.back}</span>
            </button>
            <span className="cal-title">
              <Az ru={`${RU_MONTHS_NOM[m.getMonth()]} ${m.getFullYear()}`}>{`${AZ_MONTHS[m.getMonth()][0].toUpperCase()}${AZ_MONTHS[m.getMonth()].slice(1)} ${m.getFullYear()}`}</Az>
            </span>
            <button className="btn ghost" disabled={!canFwd} onClick={() => shiftMonth(1)} aria-label="Следующий месяц">
              <span className="ico">{Icon.chevron}</span>
            </button>
          </div>
          <Carpet month={month} picked={picked} onPick={(d) => setPicked(d === picked ? undefined : d)} />
          <p className="hint" style={{ textAlign: 'center' }}>
            {picked ? `${dayLabel(picked).ru}: ${xp.byDay.get(picked) ?? 0} XP` : `${monthXp} XP за месяц · каждый ряд — день, пропуск — пустые нити`}
          </p>
        </div>
      </section>

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
    const earned = prev != null && xp.total > prev && xp.total - prev <= 60 ? xp.total - prev : 0;
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
