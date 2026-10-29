import { describe, expect, it } from 'vitest';
import { isOpen, matches, noteToTask, pieces, splitNumbered, tagsOf } from './notes';

const note = (f: Record<string, unknown>) => ({ id: 'n', createdAt: 0, updatedAt: 0, deletedAt: null, _ts: {}, text: '', images: [], pinned: false, ...f }) as any;

describe('избранное', () => {
  it('сообщение → задача', () => {
    expect(noteToTask(note({ text: 'Купить краску\nбелую, 2 банки' }))).toEqual({ title: 'Купить краску', description: 'белую, 2 банки' });
    expect(noteToTask(note({ text: '', images: ['abc'] }))).toEqual({ title: 'Картинка из избранного', description: '![](img:abc)' });
    const long = 'а'.repeat(150);
    const r = noteToTask(note({ text: long }));
    expect(r.title.length).toBeLessThanOrEqual(101);
    expect(r.description).toContain(long);
  });

  it('ссылки и теги', () => {
    expect(pieces('Глянуть https://example.com/a?b=1, потом #идея и #купить_молоко.')).toEqual([
      { kind: 'text', text: 'Глянуть ' },
      { kind: 'url', text: 'https://example.com/a?b=1' },
      { kind: 'text', text: ', потом ' },
      { kind: 'tag', text: '#идея' },
      { kind: 'text', text: ' и ' },
      { kind: 'tag', text: '#купить_молоко' },
      { kind: 'text', text: '.' },
    ]);
    expect(tagsOf('#Ремонт и С#')).toEqual(['#ремонт']);
  });

  it('разобранность и поиск', () => {
    expect(isOpen(note({}))).toBe(true);
    expect(isOpen(note({ reviewed: true }))).toBe(false);
    expect(isOpen(note({ movedTo: { kind: 'task', id: 't', title: 'x' } }))).toBe(false);
    expect(matches(note({ text: 'Идея для #ремонт кухни' }), 'кухни #ремонт')).toBe(true);
    expect(matches(note({ text: 'Идея' }), 'кухни')).toBe(false);
  });
});

describe('план списком', () => {
  it('нумерованный список → отдельные сообщения без номеров', () => {
    expect(splitNumbered('1. Зарядка\n2. Позвонить маме\n3) Купить хлеб')).toEqual(['Зарядка', 'Позвонить маме', 'Купить хлеб']);
  });
  it('заголовок до списка и продолжение пункта', () => {
    expect(splitNumbered('План на день:\n1. Отчёт\nдо обеда\n2. Спортзал')).toEqual(['План на день:', 'Отчёт\nдо обеда', 'Спортзал']);
  });
  it('один пункт или обычный текст — не трогаем', () => {
    expect(splitNumbered('1. Только это')).toEqual(['1. Только это']);
    expect(splitNumbered('Купить 2 кг\nи ещё 3 штуки')).toEqual(['Купить 2 кг\nи ещё 3 штуки']);
  });
});

it('номер пункта не попадает в название задачи', () => {
  expect(noteToTask({ text: '3. Купить хлеб', images: [] } as any).title).toBe('Купить хлеб');
});
