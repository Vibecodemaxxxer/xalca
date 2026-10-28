import { describe, expect, it } from 'vitest';
import { QUOTES, quoteFor, type QuotePlace } from './quotes';

describe('quotes', () => {
  it('в каждом разделе есть хотя бы 3 цитаты', () => {
    for (const p of ['today', 'routines', 'projects', 'tasks', 'profile', 'rankup'] as QuotePlace[]) {
      expect(QUOTES.filter((q) => q.places.includes(p)).length).toBeGreaterThanOrEqual(3);
    }
  });

  it('у каждой цитаты есть оригинал, перевод, автор и источник; строк столько же', () => {
    for (const q of QUOTES) {
      expect(q.az && q.ru && q.author.az && q.author.ru && q.source).toBeTruthy();
      expect(q.ru.split('\n').length).toBe(q.az.split('\n').length);
    }
  });

  it('цитата стабильна в течение дня и подходит разделу', () => {
    const a = quoteFor('today', '2026-10-28');
    expect(quoteFor('today', '2026-10-28')).toBe(a);
    expect(a.places).toContain('today');
  });
});
