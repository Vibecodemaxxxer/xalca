import { useEffect, useState } from 'react';
import { mmss, TEA_PRESETS, teaEnds, teaPhase, type TeaState } from '../domain/tea';
import { Az } from '../i18n/Az';
import { tr } from '../i18n/lang';
import { today } from '../lib/date';
import { cancelOneOff, permissionState, requestPermission, scheduleOneOff, TIMER_IDS } from '../notify/notify';
import { Sheet } from './common';

// Состояние таймера живёт на устройстве (localStorage): у каждого устройства свой чай.
const KEY = 'xalca.tea';
const CUPS = 'xalca.tea.cups';

function load<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null');
  } catch {
    return null;
  }
}
function save(key: string, v: unknown) {
  try {
    if (v == null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* приватный режим */
  }
}

function cupsToday(): number {
  const c = load<{ day: string; n: number }>(CUPS);
  return c?.day === today() ? c.n : 0;
}

/** Общее состояние таймера с тиком раз в секунду, пока он идёт. */
function useTea() {
  const [state, setState] = useState<TeaState | null>(() => load(KEY));
  const [now, setNow] = useState(Date.now());
  const [cups, setCups] = useState(cupsToday);

  useEffect(() => {
    if (!state) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [state]);

  const ph = state ? teaPhase(state, now) : null;

  // Рабочий подход закончился — чашка заработана.
  useEffect(() => {
    if (!state || !ph || ph.phase === 'work' || state.counted) return;
    const n = cupsToday() + 1;
    save(CUPS, { day: today(), n });
    setCups(n);
    const next = { ...state, counted: true };
    save(KEY, next);
    setState(next);
  }, [ph?.phase]);

  useEffect(() => {
    if (ph?.phase === 'done') {
      save(KEY, null);
      setState(null);
    }
  }, [ph?.phase]);

  const start = async (workMin: number, breakMin: number) => {
    if ((await permissionState()) === 'prompt') await requestPermission();
    const s: TeaState = { workMin, breakMin, startedAt: Date.now() };
    save(KEY, s);
    setState(s);
    setNow(Date.now());
    const ends = teaEnds(s);
    await scheduleOneOff([
      { id: TIMER_IDS[0], title: tr('Çay vaxtı!', 'Время чая!', 'text'), body: tr(`${breakMin} dəq fasilə`, `Перерыв ${breakMin} мин`, 'text'), at: ends.work },
      { id: TIMER_IDS[1], title: tr('Fasilə bitdi', 'Перерыв окончен', 'text'), body: tr('İşə qayıt', 'Пора возвращаться к делу', 'text'), at: ends.break },
    ]);
  };

  const stop = async () => {
    save(KEY, null);
    setState(null);
    await cancelOneOff(TIMER_IDS);
  };

  return { state, ph, cups, start, stop };
}

export function TeaButton() {
  const [open, setOpen] = useState(false);
  const tea = useTea();
  const active = tea.ph && tea.ph.phase !== 'done' ? tea.ph : null;
  return (
    <>
      <button className={`tea-btn${active ? ` ${active.phase}` : ''}`} onClick={() => setOpen(true)} aria-label="Чайный перерыв">
        <Armudu level={active ? (active.phase === 'work' ? active.fraction : 1 - active.fraction) : 0.75} size={22} steam={active?.phase === 'break'} />
        {active && <span className="tea-left">{mmss(active.remainingMs)}</span>}
      </button>
      {open && <TeaSheet tea={tea} onClose={() => setOpen(false)} />}
    </>
  );
}

function TeaSheet({ tea, onClose }: { tea: ReturnType<typeof useTea>; onClose: () => void }) {
  const [preset, setPreset] = useState(0);
  const ph = tea.ph && tea.ph.phase !== 'done' ? tea.ph : null;
  const level = ph ? (ph.phase === 'work' ? ph.fraction : 1 - ph.fraction) : 0;

  return (
    <Sheet title={<Az>Çay fasiləsi</Az>} onClose={onClose}>
      <div className="tea">
        <Armudu level={level} size={150} steam={ph?.phase === 'break'} />
        {ph ? (
          <>
            <div className="tea-phase">
              <Az>{ph.phase === 'work' ? 'İş vaxtı' : 'Çay vaxtı'}</Az>
            </div>
            <div className="tea-time">{mmss(ph.remainingMs)}</div>
            <p className="hint">{ph.phase === 'work' ? 'Стакан наполняется, пока ты работаешь — чай нужно заслужить.' : 'Пей чай, пока стакан не опустеет.'}</p>
            <button className="btn" onClick={() => void tea.stop()}>
              <Az>Dayandır</Az>
            </button>
          </>
        ) : (
          <>
            <div className="seg" style={{ justifyContent: 'center' }}>
              {TEA_PRESETS.map(([w, b], i) => (
                <button key={i} className={preset === i ? 'on' : ''} onClick={() => setPreset(i)}>
                  {w} + {b}
                </button>
              ))}
            </div>
            <p className="hint">
              {TEA_PRESETS[preset][0]} мин работы, потом {TEA_PRESETS[preset][1]} мин на чай. Уведомление придёт, даже если закрыть приложение.
            </p>
            <button className="btn primary" onClick={() => void tea.start(...TEA_PRESETS[preset])}>
              <Az>Başla</Az>
            </button>
          </>
        )}
        <p className="hint tea-cups">
          <Az>Bu gün içilən çay</Az>: {tea.cups}
        </p>
      </div>
    </Sheet>
  );
}

/** Стакан армуду (грушевидный), level — уровень чая 0…1. */
export function Armudu({ level, size, steam }: { level: number; size: number; steam?: boolean }) {
  const lv = Math.max(0, Math.min(1, level));
  // чай заполняет внутренность стакана снизу: от y=54 (дно) до y=10 (край)
  const top = 54 - lv * 42;
  const id = `arm${size}`;
  return (
    <svg className="armudu" width={size} height={size} viewBox="0 0 64 64" aria-hidden>
      <defs>
        <clipPath id={id}>
          <path d="M22 10 h20 c0 8 -7 13 -7 20 c0 8 12 10 12 19 c0 5 -5 6 -15 6 c-10 0 -15 -1 -15 -6 c0 -9 12 -11 12 -19 c0 -7 -7 -12 -7 -20z" />
        </clipPath>
        <linearGradient id={`${id}t`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#c0392b" />
          <stop offset="1" stopColor="#7a1f12" />
        </linearGradient>
      </defs>
      {steam && (
        <g className="steam" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" opacity=".45">
          <path d="M27 7 c-2 -2 2 -3 0 -5" />
          <path d="M32 7 c-2 -2 2 -3 0 -5" />
          <path d="M37 7 c-2 -2 2 -3 0 -5" />
        </g>
      )}
      <g clipPath={`url(#${id})`}>
        <rect x="0" y={top} width="64" height="64" fill={`url(#${id}t)`} />
        <rect x="0" y={top} width="64" height="1.4" fill="#e8a24a" opacity=".7" />
      </g>
      <path
        d="M22 10 h20 c0 8 -7 13 -7 20 c0 8 12 10 12 19 c0 5 -5 6 -15 6 c-10 0 -15 -1 -15 -6 c0 -9 12 -11 12 -19 c0 -7 -7 -12 -7 -20z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity=".8"
      />
      <path d="M25 13 c0 6 4 9 4 14" stroke="#fff" strokeWidth="1.2" opacity=".35" fill="none" />
      {/* блюдце */}
      <ellipse cx="32" cy="58" rx="22" ry="3.2" fill="none" stroke="#c8902e" strokeWidth="1.8" />
      <path d="M14 57.5 q18 5 36 0" stroke="#c8902e" strokeWidth="1.2" fill="none" opacity=".6" />
    </svg>
  );
}
