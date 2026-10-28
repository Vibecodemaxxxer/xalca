import { useSyncExternalStore } from 'react';

/**
 * Язык интерфейса:
 *  az    — всё по-азербайджански, перевод во всплывашке;
 *  ru    — всё по-русски;
 *  mixed — кнопки и выбор по-русски, обычный текст по-азербайджански (перевод по тапу).
 * Какой вариант слова виден, решает CSS по html[data-lang] (см. styles.css), поэтому переключение мгновенное.
 */
export type Lang = 'az' | 'ru' | 'mixed';

let lang: Lang = 'az';
const subs = new Set<() => void>();

export const getLang = () => lang;

export function setLang(l: Lang) {
  lang = l;
  document.documentElement.dataset.lang = l;
  document.documentElement.lang = l === 'ru' ? 'ru' : 'az';
  subs.forEach((fn) => fn());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (fn) => {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    () => lang,
  );
}

/**
 * Строка для мест, где нельзя вставить <Az> (placeholder, <option>, уведомления).
 *  control — элемент управления: в смешанном режиме по-русски; в азербайджанском у option — оба языка.
 *  text    — обычный текст: как у <Az> вне кнопок.
 */
export function tr(az: string, ru: string, kind: 'control' | 'option' | 'text' = 'control', l: Lang = lang): string {
  if (l === 'ru') return ru;
  if (kind === 'text') return az;
  if (l === 'mixed') return ru;
  return kind === 'option' ? `${az} — ${ru}` : az;
}
