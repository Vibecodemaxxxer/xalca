import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { dict } from './dict';
import { getLang } from './lang';

// Одновременно открыта только одна подсказка.
let closeOpen: (() => void) | null = null;

const LONG_PRESS = 450;
const INTERACTIVE = 'button, a, label, select, [role=button]';

/**
 * Слово интерфейса на двух языках. Видимый вариант выбирает CSS по html[data-lang];
 * всплывашка показывает другой вариант.
 * ПК — при наведении. Телефон — по тапу, а внутри кнопок/ссылок — по долгому нажатию,
 * чтобы обычный тап продолжал нажимать кнопку.
 */
export function Az({ children, ru }: { children: string; ru?: string }) {
  const tr = ru ?? dict[children];
  // Как подпись — короткая часть перевода («Привычки (рутина)» → «Привычки»); пояснение остаётся во всплывашке.
  const short = tr?.split(/ \(| — /)[0];
  const ref = useRef<HTMLSpanElement>(null);
  const [tip, setTip] = useState<{ rect: DOMRect; text: string } | null>(null);
  const press = useRef<{ timer?: ReturnType<typeof setTimeout>; fired: boolean }>({ fired: false });

  const interactive = () => !!ref.current?.closest(INTERACTIVE);

  const show = () => {
    if (!ref.current || !tr) return;
    const lang = getLang();
    if (lang === 'ru') return;
    // В смешанном режиме в кнопках виден русский — подсказываем оригинал.
    const text = lang === 'mixed' && interactive() ? children : tr;
    if (closeOpen && closeOpen !== hide) closeOpen();
    closeOpen = hide;
    setTip({ rect: ref.current.getBoundingClientRect(), text });
  };
  const hide = () => {
    setTip(null);
    if (closeOpen === hide) closeOpen = null;
  };

  useEffect(() => {
    if (!tip) return;
    const off = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) hide();
    };
    const t = setTimeout(() => {
      document.addEventListener('pointerdown', off);
      window.addEventListener('scroll', hide, true);
    });
    return () => {
      clearTimeout(t);
      document.removeEventListener('pointerdown', off);
      window.removeEventListener('scroll', hide, true);
    };
  }, [tip]);

  if (!tr) return <>{children}</>;

  return (
    <span
      ref={ref}
      className="az"
      onPointerEnter={(e) => e.pointerType === 'mouse' && show()}
      onPointerLeave={(e) => e.pointerType === 'mouse' && hide()}
      onPointerDown={(e) => {
        if (e.pointerType === 'mouse') return;
        press.current.fired = false;
        press.current.timer = setTimeout(() => {
          press.current.fired = true;
          show();
        }, LONG_PRESS);
      }}
      onPointerUp={() => clearTimeout(press.current.timer)}
      onPointerCancel={() => clearTimeout(press.current.timer)}
      onContextMenu={(e) => e.preventDefault()}
      onClick={(e) => {
        if (press.current.fired) {
          // Долгое нажатие показало перевод — кнопку не нажимаем.
          e.preventDefault();
          e.stopPropagation();
          press.current.fired = false;
          return;
        }
        if (!matchMedia('(hover: hover)').matches && !interactive()) {
          if (tip) hide();
          else show();
        }
      }}
    >
      <span className="az-t">{children}</span>
      <span className="ru-t">{short}</span>
      {tip && createPortal(<Tip rect={tip.rect} text={tip.text} />, document.body)}
    </span>
  );
}

function Tip({ rect, text }: { rect: DOMRect; text: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: rect.left, top: rect.top - 8 });

  useEffect(() => {
    const el = ref.current!;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - w / 2, window.innerWidth - w - 8));
    const below = rect.top - h - 8 < 8;
    setPos({ left, top: below ? rect.bottom + 6 : rect.top - h - 6 });
  }, [rect]);

  return (
    <div ref={ref} className="az-tip" style={{ left: pos.left, top: pos.top }} role="tooltip">
      {text}
    </div>
  );
}
