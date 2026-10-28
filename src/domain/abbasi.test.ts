import { expect, it } from 'vitest';
import { earnedAbbasi, shelf, spentAbbasi } from './abbasi';

const base = { createdAt: 0, updatedAt: 0, deletedAt: null, _ts: {} };

it('abbası: заработано, потрачено, витрина', () => {
  expect(earnedAbbasi(0, 0)).toBe(0);
  expect(earnedAbbasi(49, 0)).toBe(9);
  expect(earnedAbbasi(100, 2)).toBe(120);

  const rewards = [
    { ...base, id: 'a', title: 'Пицца', price: 150, repeatable: true, order: 1 },
    { ...base, id: 'b', title: 'Книга', price: 300, repeatable: false, order: 2 },
    { ...base, id: 'c', title: 'Кофе', price: 60, repeatable: true, order: 3 },
    { ...base, id: 'd', title: 'Удалена', price: 5, repeatable: true, order: 4, deletedAt: 1 },
  ] as any[];
  const purchases = [
    { ...base, id: 'p1', rewardId: 'b', title: 'Книга', price: 300, at: 1 },
    { ...base, id: 'p2', rewardId: 'a', title: 'Пицца', price: 150, at: 2 },
    { ...base, id: 'p3', rewardId: 'a', title: 'Пицца', price: 150, at: 3, deletedAt: 9 }, // отменена
  ] as any[];
  expect(spentAbbasi(purchases)).toBe(450);
  expect(shelf(rewards, purchases).map((r) => r.id)).toEqual(['c', 'a']);
});
