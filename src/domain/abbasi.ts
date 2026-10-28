import type { Purchase, Reward } from '../db/types';

// Abbası — серебряная монета Сефевидов, валюта наград.
// Заработанное вычисляется из истории (как опыт), потраченное — из записей покупок.

export const XP_PER_ABBASI = 5;
export const BADGE_ABBASI = 50;

export function earnedAbbasi(totalXp: number, badges: number): number {
  return Math.floor(totalXp / XP_PER_ABBASI) + badges * BADGE_ABBASI;
}

export function spentAbbasi(purchases: Purchase[]): number {
  return purchases.filter((p) => !p.deletedAt).reduce((a, p) => a + p.price, 0);
}

/** Награды в витрине: живые, а одноразовые — пока не куплены. */
export function shelf(rewards: Reward[], purchases: Purchase[]): Reward[] {
  const bought = new Set(purchases.filter((p) => !p.deletedAt).map((p) => p.rewardId));
  return rewards.filter((r) => !r.deletedAt && (r.repeatable || !bought.has(r.id))).sort((a, b) => a.price - b.price || a.order - b.order);
}

/** Готовые идеи для пустого рынка. */
export const REWARD_IDEAS: { title: string; price: number; repeatable: boolean }[] = [
  { title: 'Вкусняшка', price: 20, repeatable: true },
  { title: 'Серия сериала', price: 30, repeatable: true },
  { title: 'Час игр', price: 40, repeatable: true },
  { title: 'Кофе в кофейне', price: 60, repeatable: true },
  { title: 'Пицца', price: 150, repeatable: true },
  { title: 'Новая книга', price: 300, repeatable: false },
];
