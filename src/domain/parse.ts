import type { Project, TaskSize } from '../db/types';
import { addDays, toDay, weekday, type Day } from '../lib/date';

// Быстрый ввод задачи одной строкой, как в Todoist:
//   «Купить подарок завтра 18:00 #ремонт !» → дата, время, проект, большая задача.
// Понимает русский и азербайджанский.

export interface Parsed {
  title: string;
  date?: Day;
  time?: string;
  projectId?: string;
  size?: TaskSize;
  /** Что распознано — для подсказки под полем ввода. */
  found: { kind: 'date' | 'time' | 'project' | 'size'; text: string }[];
}

const WEEKDAYS: [RegExp, number][] = [
  [/^(пн|понедельник|понедельника|b\.?e\.?|bazar ertəsi)$/i, 0],
  [/^(вт|вторник|вторника|ç\.?a\.?|çərşənbə axşamı)$/i, 1],
  [/^(ср|среда|среду|среды|çərşənbə)$/i, 2],
  [/^(чт|четверг|четверга|c\.?a\.?|cümə axşamı)$/i, 3],
  [/^(пт|пятница|пятницу|пятницы|cümə)$/i, 4],
  [/^(сб|суббота|субботу|субботы|şənbə)$/i, 5],
  [/^(вс|воскресенье|воскресенья|bazar)$/i, 6],
];

const MONTHS = ['январ', 'феврал', 'март', 'апрел', 'ма', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];
const AZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];

/** Дата не раньше сегодняшней: если день уже прошёл в этом году — следующий год. */
function futureDate(today: Day, month0: number, day: number, year?: number): Day | undefined {
  const t = new Date(today);
  let y = year ?? Number(today.slice(0, 4));
  let d = new Date(y, month0, day);
  if (d.getMonth() !== month0) return undefined;
  if (!year && toDay(d) < today) {
    y++;
    d = new Date(y, month0, day);
  }
  void t;
  return toDay(d);
}

export function parseQuick(input: string, today: Day, projects: Project[] = []): Parsed {
  const found: Parsed['found'] = [];
  let s = ` ${input} `;
  let date: Day | undefined;
  let time: string | undefined;
  let projectId: string | undefined;
  let size: TaskSize | undefined;

  const take = (re: RegExp, fn: (m: RegExpMatchArray) => boolean) => {
    const m = s.match(re);
    if (m && fn(m)) {
      s = s.replace(m[0], ' ');
      return true;
    }
    return false;
  };

  // время: «в 18:00», «18:00», «saat 9:30»
  take(/\s(?:в|saat)?\s?([01]?\d|2[0-3]):([0-5]\d)(?=\s)/i, (m) => {
    time = `${m[1].padStart(2, '0')}:${m[2]}`;
    found.push({ kind: 'time', text: time });
    return true;
  });

  // относительные дни
  const rel: [RegExp, number, string][] = [
    [/\s(послезавтра|birigün|o biri gün)(?=\s)/i, 2, 'послезавтра'],
    [/\s(сегодня|bu gün|bugün)(?=\s)/i, 0, 'сегодня'],
    [/\s(завтра|sabah)(?=\s)/i, 1, 'завтра'],
  ];
  for (const [re, n] of rel) {
    if (date) break;
    take(re, (m) => {
      date = addDays(today, n);
      found.push({ kind: 'date', text: m[1] });
      return true;
    });
  }

  // «через 3 дня», «3 gün sonra»
  if (!date)
    take(/\s(?:через\s(\d{1,3})\s(?:дн|день|дня|дней)\S*|(\d{1,3})\sgün\ssonra)(?=\s)/i, (m) => {
      const n = Number(m[1] ?? m[2]);
      date = addDays(today, n);
      found.push({ kind: 'date', text: m[0].trim() });
      return true;
    });

  // «25.11», «25.11.2026», «25/11»
  if (!date)
    take(/\s(\d{1,2})[./](\d{1,2})(?:[./](\d{4}))?(?=\s)/, (m) => {
      const d = futureDate(today, Number(m[2]) - 1, Number(m[1]), m[3] ? Number(m[3]) : undefined);
      if (!d) return false;
      date = d;
      found.push({ kind: 'date', text: m[0].trim() });
      return true;
    });

  // «25 ноября», «25 noyabr»
  if (!date)
    take(/\s(\d{1,2})\s([а-яёa-zəıöüğçş]+)(?=\s)/i, (m) => {
      const w = m[2].toLowerCase();
      let mi = AZ_MONTHS.indexOf(w);
      if (mi < 0) mi = MONTHS.findIndex((p) => w.startsWith(p) && (p !== 'ма' || /^ма[йя]$/.test(w)));
      if (mi < 0) return false;
      const d = futureDate(today, mi, Number(m[1]));
      if (!d) return false;
      date = d;
      found.push({ kind: 'date', text: m[0].trim() });
      return true;
    });

  // день недели: «в пятницу», «cümə»
  if (!date) {
    const words = s.trim().split(/\s+/);
    for (let i = 0; i < words.length && !date; i++) {
      // двухсловные азербайджанские названия
      for (const cand of [`${words[i]} ${words[i + 1] ?? ''}`.trim(), words[i]]) {
        const hit = WEEKDAYS.find(([re]) => re.test(cand));
        if (!hit) continue;
        const delta = (hit[1] - weekday(today) + 7) % 7;
        date = addDays(today, delta);
        found.push({ kind: 'date', text: cand });
        const prev = words[i - 1];
        const re = new RegExp(`\\s${prev && /^(в|во|до)$/i.test(prev) ? `${prev}\\s` : ''}${cand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=\\s)`, 'i');
        s = s.replace(re, ' ');
        break;
      }
    }
  }

  // проект: «#ремонт», «#ремонт_кухни»
  take(/\s#(\S+)(?=\s)/, (m) => {
    const tag = m[1].toLowerCase().replace(/_/g, ' ');
    const p = projects.find((x) => !x.deletedAt && !x.archived && x.title.toLowerCase().startsWith(tag));
    if (!p) return false;
    projectId = p.id;
    found.push({ kind: 'project', text: p.title });
    return true;
  });

  // большая задача: «!» отдельным словом
  take(/\s!{1,3}(?=\s)/, () => {
    size = 'l';
    found.push({ kind: 'size', text: '!' });
    return true;
  });

  const title = s.replace(/\s+/g, ' ').trim();
  return { title: title || input.trim(), date, time, projectId, size, found };
}
