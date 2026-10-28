import { quoteFor, type QuotePlace } from '../domain/quotes';
import { Az } from '../i18n/Az';
import { today } from '../lib/date';

/** Цитата дня для раздела: оригинал на азербайджанском, перевод — тапом (или сразу, в русском режиме). */
export function QuoteCard({ place, salt }: { place: QuotePlace; salt?: number }) {
  const q = quoteFor(place, today(), salt);
  return (
    <figure className="quote">
      <blockquote>
        <Az ru={q.ru} full>
          {q.az}
        </Az>
      </blockquote>
      <figcaption>
        —{' '}
        <Az ru={q.author.ru} full>
          {q.author.az}
        </Az>
        <span className="quote-src">{q.source}</span>
      </figcaption>
    </figure>
  );
}
