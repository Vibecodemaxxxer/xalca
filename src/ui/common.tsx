import { useEffect, type ReactNode } from 'react';
import { Az } from '../i18n/Az';

const svg = (d: ReactNode, extra = {}) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...extra}>
    {d}
  </svg>
);

export const Icon = {
  today: svg(<><circle cx="12" cy="12" r="4.5" /><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" /></>),
  routine: svg(<><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 4v5h-5" /><path d="M9 12l2 2 4-4" /></>),
  tasks: svg(<><rect x="4" y="3.5" width="16" height="17" rx="3" /><path d="M8 9h8M8 13h8M8 17h5" /></>),
  settings: svg(<><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>),
  projects: svg(<><path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.2h7a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z" /><path d="M8 13h8" /></>),
  image: svg(<><rect x="3.5" y="4.5" width="17" height="15" rx="2.5" /><circle cx="9" cy="10" r="1.6" /><path d="M20.5 16l-5-5-8.5 8.5" /></>),
  back: svg(<path d="M15 5l-7 7 7 7" />, { strokeWidth: 2.2 }),
  chevron: svg(<path d="M9 6l6 6-6 6" />, { strokeWidth: 2.2 }),
  note: svg(<><path d="M6 3.5h9l3.5 3.5v13.5H6z" /><path d="M9 11h6M9 15h6" /></>),
  trash: svg(<><path d="M4.5 7h15M10 11v6M14 11v6" /><path d="M6 7l1 13h10l1-13M9 7V4.5h6V7" /></>),
  plus: svg(<path d="M12 5v14M5 12h14" />, { strokeWidth: 2.4 }),
  check: svg(<path d="M5 12.5l4.5 4.5L19 7.5" />, { strokeWidth: 3.2 }),
  sync: svg(<><path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3" /><path d="M18 2.5v4.2h-4.2M6 21.5v-4.2h4.2" /></>),
  bell: svg(<><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></>),
  clock: svg(<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>),
  repeat: svg(<><path d="M17 2l4 4-4 4" /><path d="M3 11V9a3 3 0 0 1 3-3h15M7 22l-4-4 4-4" /><path d="M21 13v2a3 3 0 0 1-3 3H3" /></>),
};

/** Бута — орнамент «пейсли». */
export function Buta({ className = 'buta' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round">
      <path d="M15.5 3.5c-1.5 2-6.5 3-8.5 7.5-2 4.6.8 9.5 5.6 9.5 4.4 0 7.4-3.6 6.8-7.6-.4-3-3.2-4.7-5.6-3.9-2 .7-2.4 3.2-1 4.2" />
      <path d="M12.6 16.6c-2-.3-3.2-2-2.8-4" opacity=".6" />
      <circle cx="15.5" cy="3.5" r=".8" fill="currentColor" />
    </svg>
  );
}

/** Шторка снизу; panel — на ПК открывается панелью справа (карточка задачи). */
export function Sheet({ title, onClose, children, panel }: { title?: ReactNode; onClose: () => void; children: ReactNode; panel?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className={`sheet-bg${panel ? ' panel' : ''}`} onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet" role="dialog">
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>
  );
}

export function Check({ on, onToggle, label }: { on: boolean; onToggle: () => void; label?: string }) {
  return (
    <button className={`check${on ? ' on' : ''}`} onClick={onToggle} aria-label={label ?? (on ? 'Снять отметку' : 'Отметить')}>
      {Icon.check}
    </button>
  );
}

export function Section({ title, count, className = '', children }: { title: string; count?: number; className?: string; children: ReactNode }) {
  return (
    <section className={`section ${className}`}>
      <h2>
        <Az>{title}</Az>
        {count != null && <span className="count">· {count}</span>}
      </h2>
      {children}
    </section>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>
        <Az>{label}</Az>
      </span>
      {children}
    </label>
  );
}

export function Empty({ az, ru }: { az: string; ru?: string }) {
  return (
    <div className="empty">
      <Buta />
      <div>
        <Az ru={ru}>{az}</Az>
      </div>
    </div>
  );
}

export function Stepper({ value, target, unit, onChange }: { value: number; target: number; unit: string; onChange: (v: number) => void }) {
  return (
    <div className="stepper">
      <button onClick={() => onChange(value - 1)} aria-label="Меньше">−</button>
      <span className="val">
        {value}/{target}
        {unit ? ` ${unit}` : ''}
      </span>
      <button onClick={() => onChange(value + 1)} aria-label="Больше">+</button>
    </div>
  );
}

export function Bar({ cur, target }: { cur: number; target: number }) {
  return (
    <div className="bar">
      <i style={{ width: `${Math.min(100, (cur / Math.max(1, target)) * 100)}%` }} />
    </div>
  );
}
