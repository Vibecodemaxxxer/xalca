import type { Recurrence } from '../db/types';
import { addDays, daysInMonth, diffDays, parseDay, weekday, type Day } from '../lib/date';

/** Попадает ли день в расписание (для режима 'after' не применяется). */
export function isScheduled(r: Recurrence, day: Day): boolean {
  if (day < r.start) return false;
  switch (r.kind) {
    case 'daily':
      return diffDays(r.start, day) % r.interval === 0;
    case 'weekly': {
      if (!r.weekdays.includes(weekday(day))) return false;
      const weeks = diffDays(monday(r.start), monday(day)) / 7;
      return weeks % r.interval === 0;
    }
    case 'monthly': {
      const s = parseDay(r.start);
      const d = parseDay(day);
      const months = (d.getFullYear() - s.getFullYear()) * 12 + d.getMonth() - s.getMonth();
      if (months % r.interval !== 0) return false;
      return d.getDate() === monthlyDate(r.on, d.getFullYear(), d.getMonth());
    }
    case 'after':
      return false;
  }
}

function monday(day: Day): Day {
  return addDays(day, -weekday(day));
}

/** Какое число месяца соответствует правилу. */
function monthlyDate(on: Extract<Recurrence, { kind: 'monthly' }>['on'], y: number, m: number): number {
  const last = daysInMonth(y, m);
  if ('day' in on) return on.day === -1 ? last : Math.min(on.day, last);
  const firstWd = (new Date(y, m, 1).getDay() + 6) % 7;
  const first = 1 + ((on.weekday - firstWd + 7) % 7);
  if (on.nth > 0) {
    const d = first + (on.nth - 1) * 7;
    return d <= last ? d : -1;
  }
  let d = first;
  while (d + 7 <= last) d += 7;
  return d;
}

/** Когда рутина «после выполнения» снова станет нужна. */
export function nextAfter(r: Extract<Recurrence, { kind: 'after' }>, lastDone: Day | undefined): Day {
  if (!lastDone) return r.start;
  const next = addDays(lastDone, r.days);
  return next > r.start ? next : r.start;
}

/**
 * Нужно ли делать рутину в этот день.
 * lastDone — последнее выполнение строго до этого дня (для режима 'after').
 * В режиме 'after' невыполненная рутина переносится на следующие дни.
 */
export function isDue(r: Recurrence, day: Day, lastDone?: Day): boolean {
  if (r.kind === 'after') return day >= nextAfter(r, lastDone);
  return isScheduled(r, day);
}

/** Ближайшие дни выполнения начиная с from (включительно), не дальше horizon дней. */
export function upcoming(r: Recurrence, from: Day, horizon: number, lastDone?: Day): Day[] {
  if (r.kind === 'after') {
    const next = nextAfter(r, lastDone);
    const d = next < from ? from : next;
    return diffDays(from, d) <= horizon ? [d] : [];
  }
  const out: Day[] = [];
  for (let i = 0; i <= horizon; i++) {
    const d = addDays(from, i);
    if (isScheduled(r, d)) out.push(d);
  }
  return out;
}

/**
 * Стрик: сколько раз подряд рутина выполнена вовремя, считая назад от сегодня.
 * Сегодняшний невыполненный день стрик не обрывает — день ещё не закончился.
 */
export function streak(r: Recurrence, done: Set<Day>, today: Day): number {
  if (r.kind === 'after') {
    const days = [...done].filter((d) => d <= today).sort();
    if (!days.length) return 0;
    if (today > addDays(days[days.length - 1], r.days)) return 0;
    let n = 1;
    for (let i = days.length - 1; i > 0; i--) {
      if (diffDays(days[i - 1], days[i]) > r.days) break;
      n++;
    }
    return n;
  }
  let n = 0;
  let d = today;
  if (!done.has(d)) d = addDays(d, -1);
  for (let guard = 0; guard < 3660 && d >= r.start; guard++, d = addDays(d, -1)) {
    if (!isScheduled(r, d)) continue;
    if (!done.has(d)) break;
    n++;
  }
  return n;
}

const WD_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];
// Винительный падеж: м — понедельник, ж — среду, ср — воскресенье.
const WD_GENDER = [0, 0, 1, 0, 1, 1, 2];
const NTH = [
  ['', 'первый', 'второй', 'третий', 'четвёртый'],
  ['', 'первую', 'вторую', 'третью', 'четвёртую'],
  ['', 'первое', 'второе', 'третье', 'четвёртое'],
];
const LAST = ['последний', 'последнюю', 'последнее'];
const WD_ACC = ['понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу', 'воскресенье'];

/** Человекочитаемое описание правила. */
export function describe(r: Recurrence): string {
  switch (r.kind) {
    case 'daily':
      return r.interval === 1 ? 'каждый день' : `раз в ${r.interval} ${plural(r.interval, 'день', 'дня', 'дней')}`;
    case 'weekly': {
      const days = [...r.weekdays].sort().map((d) => WD_SHORT[d]).join(', ');
      if (r.weekdays.length === 7 && r.interval === 1) return 'каждый день';
      if (r.weekdays.length === 1) {
        const wd = r.weekdays[0];
        const every = ['каждый', 'каждую', 'каждое'][WD_GENDER[wd]];
        return r.interval === 1 ? `${every} ${WD_ACC[wd]}` : `${every} ${r.interval}-й ${WD_ACC[wd]}`.replace(/каждую (\d+)-й/, 'каждую $1-ю').replace(/каждое (\d+)-й/, 'каждое $1-е');
      }
      return r.interval === 1 ? days : `${days} · раз в ${r.interval} нед.`;
    }
    case 'monthly': {
      const every = r.interval === 1 ? 'каждый месяц' : `раз в ${r.interval} мес.`;
      if ('day' in r.on) return `${every}, ${r.on.day === -1 ? 'последний день' : `${r.on.day}-го`}`;
      const g = WD_GENDER[r.on.weekday];
      const nth = r.on.nth === -1 ? LAST[g] : NTH[g][r.on.nth];
      return `${every}, ${nth} ${WD_ACC[r.on.weekday]}`;
    }
    case 'after':
      return `через ${r.days} ${plural(r.days, 'день', 'дня', 'дней')} после выполнения`;
  }
}

export function plural(n: number, one: string, few: string, many: string): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
