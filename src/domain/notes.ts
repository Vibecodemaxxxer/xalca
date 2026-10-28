import type { Note } from '../db/types';
import { IMG_PREFIX } from '../sync/images';

/** Опыт за каждое разобранное сообщение. */
export const NOTE_XP = 2;

export const isOpen = (n: Note) => !n.deletedAt && !n.movedTo && !n.reviewed;

/** Название и описание задачи из сообщения: первая строка — название, остальное и картинки — описание. */
export function noteToTask(n: Note): { title: string; description: string } {
  const lines = n.text.trim().split('\n');
  let title = (lines[0] ?? '').trim();
  let rest = lines.slice(1).join('\n').trim();
  if (title.length > 120) {
    rest = `${title}\n\n${rest}`.trim();
    title = `${title.slice(0, 100).trimEnd()}…`;
  }
  if (!title) title = n.images.length ? 'Картинка из избранного' : 'Заметка';
  const imgs = n.images.map((h) => `![](${IMG_PREFIX}${h})`).join('\n\n');
  return { title, description: [rest, imgs].filter(Boolean).join('\n\n') };
}

/** Текст сообщения на кусочки: обычный текст, ссылки и #теги. */
export type Piece = { kind: 'text' | 'url' | 'tag'; text: string };

const TOKEN = /(https?:\/\/[^\s<]+[^\s<.,:;!?)\]'"»]|www\.[^\s<]+[^\s<.,:;!?)\]'"»]|(?:^|(?<=\s))#[\p{L}\p{N}_]+)/gu;

export function pieces(text: string): Piece[] {
  const out: Piece[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const i = m.index!;
    if (i > last) out.push({ kind: 'text', text: text.slice(last, i) });
    out.push({ kind: m[0].startsWith('#') ? 'tag' : 'url', text: m[0] });
    last = i + m[0].length;
  }
  if (last < text.length) out.push({ kind: 'text', text: text.slice(last) });
  return out;
}

export const tagsOf = (text: string) => pieces(text).filter((p) => p.kind === 'tag').map((p) => p.text.toLowerCase());

/** Поиск по ленте: по словам и тегам, без учёта регистра. */
export function matches(n: Note, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const t = n.text.toLowerCase();
  return s.split(/\s+/).every((w) => t.includes(w));
}
