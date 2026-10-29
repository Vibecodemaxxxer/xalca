import { useLayoutEffect, useRef, useState } from 'react';
import { quoteFor } from '../domain/quotes';
import { dayStreak, rankFor } from '../domain/xp';
import { Az } from '../i18n/Az';
import { getLang } from '../i18n/lang';
import { addDays, parseDay, today, type Day } from '../lib/date';
import { Coin } from './Bazar';
import { Buta, Icon, Sheet } from './common';
import { useData } from './data';
import { AZ_MONTHS, AZ_WD_SHORT, longDate, RU_MONTHS_NOM, RU_WD_SHORT } from './fmt';
import { Carpet } from './Game';

/** Приветствие по времени суток. */
function greeting(h: number): { az: string; ru: string } {
  if (h >= 5 && h < 12) return { az: 'Sabahınız xeyir', ru: 'Доброе утро' };
  if (h >= 12 && h < 18) return { az: 'Günortanız xeyir', ru: 'Добрый день' };
  return { az: 'Axşamınız xeyir', ru: 'Добрый вечер' };
}

/** Шапка главной: приветствие, сословие с опытом, серия дней, abbası и кнопка ковра. */
export function TodayHero() {
  const { xp, abbasi } = useData();
  const [carpet, setCarpet] = useState(false);
  const t = today();
  const g = greeting(new Date().getHours());
  const date = longDate(t);
  const r = rankFor(xp.total);
  const inRank = xp.total - r.rank.xp;
  const span = r.next ? r.next.xp - r.rank.xp : 0;
  const streak = dayStreak(xp.byDay, t);

  return (
    <section className="hero">
      <div className="hero-band" />
      <div className="hero-body">
        <div className="hero-top">
          <Buta className="hero-buta" />
          <div className="hero-hello">
            <h1>
              <Az ru={g.ru} full>
                {g.az}
              </Az>
            </h1>
            <div className="hero-date">
              <Az ru={date.ru} full>
                {date.az}
              </Az>
            </div>
          </div>
          <button className="hero-btn carpet-btn" onClick={() => setCarpet(true)} aria-label="Ковёр месяца">
            <span className="ico">{Icon.carpet}</span>
            <span className="hb-label">
              <Az ru="Ковёр">Xalça</Az>
            </span>
          </button>
          <button className="hero-btn icon" onClick={() => (location.hash = 'settings')} aria-label="Настройки">
            <span className="ico">{Icon.settings}</span>
          </button>
        </div>
        <button className="hero-rank" onClick={() => (location.hash = 'profile')}>
          <b>
            <Az ru={r.rank.ru} full>
              {r.rank.az}
            </Az>
          </b>
          <span className="hero-bar">
            <i style={{ width: `${Math.round(r.progress * 100)}%` }} />
          </span>
          <span className="hero-xp">{r.next ? `${inRank}/${span} XP` : `${xp.total} XP`}</span>
        </button>
        <div className="hero-chips">
          <button className="hero-chip" onClick={() => (location.hash = 'profile')}>
            🔥{' '}
            <Az ru={`${streak} ${daysWord(streak)} подряд`} full>{`${streak} gün ardıcıl`}</Az>
          </button>
          <button className="hero-chip" onClick={() => (location.hash = 'bazar')}>
            <Coin size={18} /> {abbasi.balance}
          </button>
        </div>
      </div>
      <div className="hero-band" />
      {carpet && <CarpetSheet onClose={() => setCarpet(false)} />}
    </section>
  );
}

function daysWord(n: number) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'день';
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'дня';
  return 'дней';
}

/** Ковёр месяца — открывается кнопкой в шапке. */
function CarpetSheet({ onClose }: { onClose: () => void }) {
  const { xp } = useData();
  const [month, setMonth] = useState(() => today().slice(0, 8) + '01');
  const [picked, setPicked] = useState<Day | undefined>();
  const m = parseDay(month);
  const inMonth = [...xp.byDay].filter(([d, v]) => d.startsWith(month.slice(0, 7)) && v > 0);
  const monthXp = inMonth.reduce((a, [, v]) => a + v, 0);
  const best = inMonth.reduce<[Day, number] | null>((b, x) => (!b || x[1] > b[1] ? x : b), null);
  const first = [...xp.byDay.keys()].sort()[0];
  const canBack = !!first && month > first.slice(0, 8) + '01';
  const canFwd = month < today().slice(0, 8) + '01';
  const shift = (k: number) => {
    const d = new Date(m.getFullYear(), m.getMonth() + k, 1);
    setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`);
    setPicked(undefined);
  };
  const az = `${AZ_MONTHS[m.getMonth()][0].toUpperCase()}${AZ_MONTHS[m.getMonth()].slice(1)} ${m.getFullYear()}`;
  return (
    <Sheet title={<Az ru="Ковёр месяца">Ayın xalçası</Az>} onClose={onClose}>
      <div className="carpet-wrap">
        <div className="cal-nav">
          <button className="btn ghost" disabled={!canBack} onClick={() => shift(-1)} aria-label="Предыдущий месяц">
            <span className="ico">{Icon.back}</span>
          </button>
          <span className="cal-title">
            <Az ru={`${RU_MONTHS_NOM[m.getMonth()]} ${m.getFullYear()}`} full>
              {az}
            </Az>
          </span>
          <button className="btn ghost" disabled={!canFwd} onClick={() => shift(1)} aria-label="Следующий месяц">
            <span className="ico">{Icon.chevron}</span>
          </button>
        </div>
        <Carpet month={month} picked={picked} onPick={(d) => setPicked(d === picked ? undefined : d)} />
        <div className="carpet-stats">
          <div>
            <b>{monthXp}</b>
            <span>XP</span>
          </div>
          <div>
            <b>{inMonth.length}</b>
            <span>
              <Az ru="дней соткано" full>
                gün toxunub
              </Az>
            </span>
          </div>
          <div>
            <b>{best ? Number(best[0].slice(8)) : '—'}</b>
            <span>
              <Az ru={best ? `лучший день · ${best[1]} XP` : 'лучший день'} full>
                {best ? `ən yaxşı gün · ${best[1]} XP` : 'ən yaxşı gün'}
              </Az>
            </span>
          </div>
        </div>
        <p className="hint carpet-hint">
          {picked ? `${Number(picked.slice(8))}-е число: ${xp.byDay.get(picked) ?? 0} XP` : 'Каждая полоска — день: больше сделано — богаче узор, пропуск — пустые нити. Тап по полоске — подробности.'}
        </p>
      </div>
    </Sheet>
  );
}

/** Цитата или пословица дня — с переводом прямо под ней. */
export function TodayQuote() {
  const q = quoteFor('today', today());
  const ru = getLang() === 'ru';
  return (
    <figure className="today-quote">
      <blockquote>{ru ? q.ru : q.az}</blockquote>
      {!ru && <div className="tq-ru">{q.ru}</div>}
      <figcaption>
        — {ru ? q.author.ru : q.author.az}
      </figcaption>
    </figure>
  );
}

/** Лента дней: сегодня и ближайшие, тап — показать задачи этого дня. */
export function DayStrip({ sel, onSel }: { sel: Day; onSel: (d: Day) => void }) {
  const { tasks } = useData();
  const t = today();
  const days = Array.from({ length: 21 }, (_, i) => addDays(t, i - 3));
  const busy = new Set(tasks.filter((x) => x.date && x.status !== 'done').map((x) => x.date!));
  const box = useRef<HTMLDivElement>(null);

  // сегодня — ближе к левому краю, как в референсе
  useLayoutEffect(() => {
    const el = box.current?.querySelector<HTMLElement>('.ds-day.today');
    if (el && box.current) box.current.scrollLeft = el.offsetLeft - box.current.offsetLeft - 120;
  }, []);

  return (
    <div className="day-strip" ref={box}>
      {days.map((d) => {
        const wd = (parseDay(d).getDay() + 6) % 7;
        return (
          <button key={d} className={`ds-day${d === sel ? ' sel' : ''}${d === t ? ' today' : ''}${d < t ? ' past' : ''}`} onClick={() => onSel(d)}>
            <span className="ds-wd">
              <Az ru={RU_WD_SHORT[wd]}>{AZ_WD_SHORT[wd]}</Az>
            </span>
            <span className="ds-num">{Number(d.slice(8))}</span>
            <span className="ds-dot">{busy.has(d) ? '◆' : ''}</span>
          </button>
        );
      })}
    </div>
  );
}
