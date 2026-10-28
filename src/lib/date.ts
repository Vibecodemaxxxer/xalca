// Даты дней храним как строки 'YYYY-MM-DD' в локальном времени.
export type Day = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toDay(d: Date): Day {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function today(): Day {
  return toDay(new Date());
}

export function parseDay(day: Day): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(day: Day, n: number): Day {
  const d = parseDay(day);
  d.setDate(d.getDate() + n);
  return toDay(d);
}

/** Разница в днях b - a (без влияния перехода на летнее время). */
export function diffDays(a: Day, b: Day): number {
  const ua = Date.UTC(...ymd(a));
  const ub = Date.UTC(...ymd(b));
  return Math.round((ub - ua) / 86_400_000);
}

function ymd(day: Day): [number, number, number] {
  const [y, m, d] = day.split('-').map(Number);
  return [y, m - 1, d];
}

/** День недели: 0 = понедельник … 6 = воскресенье. */
export function weekday(day: Day): number {
  return (parseDay(day).getDay() + 6) % 7;
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

/** Дата + время 'HH:MM' → Date. */
export function at(day: Day, time: string): Date {
  const d = parseDay(day);
  const [h, m] = time.split(':').map(Number);
  d.setHours(h, m, 0, 0);
  return d;
}
