import { addDays, type Day } from '../lib/date';
import type { EventDef } from './types';

/** Ивент для проверки каркаса: 10 дней с указанной даты. */
export const testEvent = (start: Day): EventDef => ({
  id: 'sinaq',
  title: { az: 'Sınaq iventi', ru: 'Тестовый ивент' },
  intro: { az: 'On gün ərzində hər gün bir addım', ru: 'Десять дней — каждый день по шагу' },
  dates: (y) => (Number(start.slice(0, 4)) === y ? { start, end: addDays(start, 9) } : null),
  color: '#2f7a78',
  accent: '#e0ac52',
  goal: 0.8,
  routines: [
    { key: 'gun', title: { az: 'Gündəlik addım', ru: 'Шаг дня' }, recurrence: (s) => ({ kind: 'daily', interval: 1, start: s }), time: '09:00' },
  ],
  badge: {
    title: { az: 'Sınaq nişanı', ru: 'Значок теста' },
    icon: () => (
      <svg viewBox="0 0 24 24" width="100%" height="100%">
        <circle cx="12" cy="12" r="10" fill="#2f7a78" />
        <path d="M7 12.5l3 3 7-7" stroke="#e0ac52" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      </svg>
    ),
  },
  Page: () => <p className="hint">Здесь у каждого ивента своё содержимое: история праздника, особые задания, цитаты.</p>,
});
