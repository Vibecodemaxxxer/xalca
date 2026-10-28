import { addDays, parseDay, today, weekday, type Day } from '../lib/date';

export const AZ_MONTHS = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avqust', 'sentyabr', 'oktyabr', 'noyabr', 'dekabr'];
export const RU_MONTHS_NOM = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
export const RU_MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
export const AZ_WEEKDAYS = ['Bazar ertəsi', 'Çərşənbə axşamı', 'Çərşənbə', 'Cümə axşamı', 'Cümə', 'Şənbə', 'Bazar'];
export const RU_WEEKDAYS = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье'];
export const AZ_WD_SHORT = ['B.e', 'Ç.a', 'Ç', 'C.a', 'C', 'Ş', 'B'];
export const RU_WD_SHORT = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

/** «28 oktyabr» + русский перевод для подсказки. */
export function dayLabel(day: Day): { az: string; ru: string } {
  const t = today();
  if (day === t) return { az: 'Bu gün', ru: 'Сегодня' };
  if (day === addDays(t, 1)) return { az: 'Sabah', ru: 'Завтра' };
  if (day === addDays(t, -1)) return { az: 'Dünən', ru: 'Вчера' };
  const d = parseDay(day);
  const sameYear = d.getFullYear() === parseDay(t).getFullYear();
  const y = sameYear ? '' : ` ${d.getFullYear()}`;
  return { az: `${d.getDate()} ${AZ_MONTHS[d.getMonth()]}${y}`, ru: `${d.getDate()} ${RU_MONTHS[d.getMonth()]}${y}` };
}

export function longDate(day: Day): { az: string; ru: string } {
  const d = parseDay(day);
  const wd = weekday(day);
  return {
    az: `${d.getDate()} ${AZ_MONTHS[d.getMonth()]}, ${AZ_WEEKDAYS[wd]}`,
    ru: `${d.getDate()} ${RU_MONTHS[d.getMonth()]}, ${RU_WEEKDAYS[wd].toLowerCase()}`,
  };
}
