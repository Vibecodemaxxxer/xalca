import { expect, it } from 'vitest';
import { toggleCheckbox } from './md';

it('переключает нужный чекбокс и не трогает остальные', () => {
  const md = '# Список\n- [ ] один\n- [x] два\n  - [ ] вложенный\n1. [ ] нумерованный\nтекст [ ] не чекбокс';
  expect(toggleCheckbox(md, 0)).toContain('- [x] один');
  expect(toggleCheckbox(md, 1)).toContain('- [ ] два');
  expect(toggleCheckbox(md, 2)).toContain('  - [x] вложенный');
  expect(toggleCheckbox(md, 3)).toContain('1. [x] нумерованный');
  expect(toggleCheckbox(md, 4)).toBe(md);
});
