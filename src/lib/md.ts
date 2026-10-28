const CHECKBOX = /^(\s*(?:[-*+]|\d+[.)])\s+)\[( |x|X)\]/gm;

/** Переключить n-й чекбокс `- [ ]` в markdown-тексте (счёт с нуля, в порядке появления). */
export function toggleCheckbox(md: string, n: number): string {
  let i = 0;
  return md.replace(CHECKBOX, (all, pre: string, mark: string) => (i++ === n ? `${pre}[${mark === ' ' ? 'x' : ' '}]` : all));
}
