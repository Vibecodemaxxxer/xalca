import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { dict } from './dict';

// Одновременно открыта только одна подсказка.
let closeOpen: (() => void) | null = null;

const LONG_PRESS = 450;

/**
 * Азербайджанское слово с переводом во всплывашке.
 * ПК — при наведении. Телефон — по тапу, а внутри кнопок/ссылок — по долгому нажатию,
 * чтобы обычный тап продолжал нажимать кнопку.
 */
export function Az({ children, ru }: { children: string; ru?: string }) {
  const tr = ru ?? dict[children];
  const ref = useRef<HTMLSpanElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const press = useRef<{ timer?: ReturnType<typeof setTimeout>; fired: boolean }>({ fired: false });

  const show = () => {
    if (!ref.current) return;
    if (closeOpen && closeOpen !== hide) closeOpen();
    closeOpen = hide;
    setRect(ref.current.getBoundingClientRect());
  };
  const hide = () => {
    setRect(null);
    if (closeOpen === hide) closeOpen = null;
  };

  useEffect(() => {
    if (!rect) return;
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
  }, [rect]);

  if (!tr) return <>{children}</>;

  const interactive = () => !!ref.current?.closest('button, a, label, select, [role=button]');

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
          if (rect) hide();
          else show();
        }
      }}
    >
      {children}
      {rect && createPortal(<Tip rect={rect} text={tr} />, document.body)}
    </span>
  );
}

function Tip({ rect, text }: { rect: DOMRect; text: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: rect.left, top: rect.top - 8, below: false });

  useEffect(() => {
    const el = ref.current!;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const left = Math.max(8, Math.min(rect.left + rect.width / 2 - w / 2, window.innerWidth - w - 8));
    const below = rect.top - h - 8 < 8;
    setPos({ left, top: below ? rect.bottom + 6 : rect.top - h - 6, below });
  }, [rect]);

  return (
    <div ref={ref} className="az-tip" style={{ left: pos.left, top: pos.top }} role="tooltip">
      {text}
    </div>
  );
}
