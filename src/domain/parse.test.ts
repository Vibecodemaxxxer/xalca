import { describe, expect, it } from 'vitest';
import { parseQuick } from './parse';

const T = '2026-10-28'; // среда
const projects = [{ id: 'p1', title: 'Ремонт кухни', archived: false, deletedAt: null }, { id: 'p2', title: 'Python', archived: false, deletedAt: null }] as any[];
const p = (s: string) => parseQuick(s, T, projects);

describe('быстрый ввод', () => {
  it('просто текст', () => {
    expect(p('Купить хлеб')).toMatchObject({ title: 'Купить хлеб', date: undefined, time: undefined });
  });
  it('завтра и время', () => {
    expect(p('Купить подарок завтра 18:00')).toMatchObject({ title: 'Купить подарок', date: '2026-10-29', time: '18:00' });
    expect(p('Позвонить маме в 9:30 сегодня')).toMatchObject({ title: 'Позвонить маме', date: T, time: '09:30' });
  });
  it('азербайджанский', () => {
    expect(p('Çörək al sabah saat 8:00')).toMatchObject({ title: 'Çörək al', date: '2026-10-29', time: '08:00' });
    expect(p('Dərs bu gün')).toMatchObject({ title: 'Dərs', date: T });
  });
  it('дни недели', () => {
    expect(p('Отчёт в пятницу')).toMatchObject({ title: 'Отчёт', date: '2026-10-30' });
    expect(p('Спортзал пн')).toMatchObject({ title: 'Спортзал', date: '2026-11-02' });
    expect(p('Görüş cümə axşamı')).toMatchObject({ title: 'Görüş', date: '2026-10-29' });
    expect(p('Отчёт в среду').date).toBe(T);
  });
  it('даты', () => {
    expect(p('Врач 25.11')).toMatchObject({ title: 'Врач', date: '2026-11-25' });
    expect(p('Врач 5.01')).toMatchObject({ date: '2027-01-05' });
    expect(p('Отпуск 3 января')).toMatchObject({ title: 'Отпуск', date: '2027-01-03' });
    expect(p('Концерт 12 noyabr')).toMatchObject({ title: 'Концерт', date: '2026-11-12' });
    expect(p('Дедлайн через 3 дня')).toMatchObject({ title: 'Дедлайн', date: '2026-10-31' });
  });
  it('проект и размер', () => {
    expect(p('Плитка #ремонт !')).toMatchObject({ title: 'Плитка', projectId: 'p1', size: 'l' });
    expect(p('Бот #python завтра')).toMatchObject({ title: 'Бот', projectId: 'p2', date: '2026-10-29' });
    expect(p('Пост #неттакого')).toMatchObject({ title: 'Пост #неттакого', projectId: undefined });
  });
  it('не съедает слова, похожие на даты, внутри текста', () => {
    expect(p('Прочитать 3 главы').title).toBe('Прочитать 3 главы');
    expect(p('Купить 2 мая подарок')).toMatchObject({ title: 'Купить подарок', date: '2027-05-02' });
  });
});
