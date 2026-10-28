import { useState } from 'react';
import { tr } from '../i18n/lang';
import type { Metric, Recurrence } from '../db/types';
import { describe } from '../domain/recurrence';
import { Az } from '../i18n/Az';
import { parseDay, weekday } from '../lib/date';
import { Field } from './common';
import { AZ_WD_SHORT, RU_WD_SHORT, RU_WEEKDAYS, AZ_WEEKDAYS } from './fmt';

function Seg<T extends string | number>({ value, options, onChange }: { value: T; options: { v: T; az: string; ru?: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button type="button" key={String(o.v)} className={o.v === value ? 'on' : ''} onClick={() => onChange(o.v)}>
          <Az ru={o.ru}>{o.az}</Az>
        </button>
      ))}
    </div>
  );
}

const REMINDERS: { v: number; az: string; ru: string }[] = [
  { v: -1, az: 'Yox', ru: 'Без напоминания' },
  { v: 0, az: 'Vaxtında', ru: 'В назначенное время' },
  { v: 5, az: '5 dəq', ru: 'За 5 минут' },
  { v: 15, az: '15 dəq', ru: 'За 15 минут' },
  { v: 30, az: '30 dəq', ru: 'За 30 минут' },
  { v: 60, az: '1 saat', ru: 'За час' },
  { v: 120, az: '2 saat', ru: 'За 2 часа' },
];

export function ReminderPicker({ value, onChange, hasTime }: { value: number | null | undefined; onChange: (v: number | null) => void; hasTime: boolean }) {
  return (
    <Field label="Xatırlatma">
      {hasTime ? (
        <Seg value={value ?? -1} options={REMINDERS} onChange={(v) => onChange(v < 0 ? null : v)} />
      ) : (
        <span className="hint">Укажи время, чтобы включить напоминание</span>
      )}
    </Field>
  );
}

const METRICS: { v: Metric['type']; az: string }[] = [
  { v: 'check', az: 'İşarə' },
  { v: 'number', az: 'Say' },
  { v: 'criteria', az: 'Meyarlar' },
  { v: 'subtasks', az: 'Alt tapşırıqlar' },
];

const emptyMetric = (t: Metric['type']): Metric =>
  t === 'number' ? { type: 'number', target: 10, unit: '', current: 0 } : t === 'criteria' ? { type: 'criteria', items: [] } : { type: t };

/** Метрика успеха. Для привычек доступны только галочка и число. */
export function MetricPicker({ value, onChange, kinds = ['check', 'number'] }: { value: Metric; onChange: (m: Metric) => void; kinds?: Metric['type'][] }) {
  return (
    <div className="field">
      <span>
        <Az>Məqsəd</Az>
      </span>
      <Seg value={value.type} options={METRICS.filter((m) => kinds.includes(m.v))} onChange={(t) => t !== value.type && onChange(emptyMetric(t))} />
      {value.type === 'number' && (
        <div className="grid2" style={{ marginTop: 8 }}>
          <input type="number" min={1} value={value.target} onChange={(e) => onChange({ ...value, target: Math.max(1, Number(e.target.value) || 1) })} aria-label="Цель" />
          <input type="text" placeholder="стр., км, мин…" value={value.unit} onChange={(e) => onChange({ ...value, unit: e.target.value })} aria-label="Единица" />
        </div>
      )}
      {value.type === 'criteria' && <CriteriaEditor items={value.items} onChange={(items) => onChange({ type: 'criteria', items })} />}
      {value.type === 'subtasks' && <span className="hint">Задача выполнится сама, когда будут выполнены все подзадачи.</span>}
    </div>
  );
}

function CriteriaEditor({ items, onChange }: { items: { text: string; done: boolean }[]; onChange: (i: { text: string; done: boolean }[]) => void }) {
  const [text, setText] = useState('');
  const add = () => {
    if (!text.trim()) return;
    onChange([...items, { text: text.trim(), done: false }]);
    setText('');
  };
  return (
    <div className="criteria">
      {items.map((it, i) => (
        <div key={i} className="criterion">
          <input type="checkbox" checked={it.done} onChange={() => onChange(items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)))} />
          <input type="text" value={it.text} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))} />
          <button type="button" className="btn ghost" aria-label="Удалить критерий" onClick={() => onChange(items.filter((_, j) => j !== i))}>
            ×
          </button>
        </div>
      ))}
      <div className="criterion">
        <span style={{ width: 18 }} />
        <input
          type="text"
          placeholder="Критерий: как понять, что сделано…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" className="btn ghost" aria-label="Добавить критерий" onClick={add} disabled={!text.trim()}>
          +
        </button>
      </div>
    </div>
  );
}

const NTH = [
  { v: 1, az: 'Birinci', ru: 'первый' },
  { v: 2, az: 'İkinci', ru: 'второй' },
  { v: 3, az: 'Üçüncü', ru: 'третий' },
  { v: 4, az: 'Dördüncü', ru: 'четвёртый' },
  { v: -1, az: 'Sonuncu', ru: 'последний' },
];

export function RecurrencePicker({ value: r, onChange }: { value: Recurrence; onChange: (r: Recurrence) => void }) {
  const switchKind = (kind: Recurrence['kind']) => {
    const start = r.start;
    if (kind === 'daily') onChange({ kind, interval: 1, start });
    if (kind === 'weekly') onChange({ kind, interval: 1, weekdays: [weekday(start)], start });
    if (kind === 'monthly') onChange({ kind, interval: 1, start, on: { day: parseDay(start).getDate() } });
    if (kind === 'after') onChange({ kind, days: 2, start });
  };
  const unit = r.kind === 'daily' ? 'gün' : r.kind === 'weekly' ? 'həftə' : 'ay';
  const unitRu = r.kind === 'daily' ? 'дней' : r.kind === 'weekly' ? 'недель' : 'месяцев';

  return (
    <>
      <Field label="Təkrar">
        <Seg
          value={r.kind}
          options={[
            { v: 'daily', az: 'Gündəlik' },
            { v: 'weekly', az: 'Həftəlik' },
            { v: 'monthly', az: 'Aylıq' },
            { v: 'after', az: 'İcradan sonra' },
          ]}
          onChange={switchKind}
        />
      </Field>

      {r.kind !== 'after' && (
        <div className="field">
          <span>
            <Az>Hər</Az> N <Az ru={unitRu}>{unit}</Az>
          </span>
          <input type="number" min={1} value={r.interval} onChange={(e) => onChange({ ...r, interval: Math.max(1, Number(e.target.value) || 1) })} />
        </div>
      )}

      {r.kind === 'weekly' && (
        <Field label="Günlər">
          <div className="seg">
            {AZ_WD_SHORT.map((az, i) => (
              <button
                type="button"
                key={i}
                className={r.weekdays.includes(i) ? 'on' : ''}
                onClick={() => {
                  const next = r.weekdays.includes(i) ? r.weekdays.filter((d) => d !== i) : [...r.weekdays, i];
                  if (next.length) onChange({ ...r, weekdays: next.sort() });
                }}
              >
                <Az ru={RU_WD_SHORT[i]}>{az}</Az>
              </button>
            ))}
          </div>
        </Field>
      )}

      {r.kind === 'monthly' && (
        <>
          <div className="field">
            <Seg
              value={'day' in r.on ? 'day' : 'nth'}
              options={[
                { v: 'day', az: 'Ayın günü' },
                { v: 'nth', az: 'Həftə günü' },
              ]}
              onChange={(m) => onChange({ ...r, on: m === 'day' ? { day: parseDay(r.start).getDate() } : { nth: 1, weekday: weekday(r.start) } })}
            />
          </div>
          {'day' in r.on ? (
            <div className="field">
              <select value={r.on.day} onChange={(e) => onChange({ ...r, on: { day: Number(e.target.value) } })}>
                {Array.from({ length: 31 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
                <option value={-1}>{tr('Ayın sonu', 'Последний день', 'option')}</option>
              </select>
            </div>
          ) : (
            <div className="grid2 field">
              <select value={r.on.nth} onChange={(e) => 'nth' in r.on && onChange({ ...r, on: { ...r.on, nth: Number(e.target.value) } })}>
                {NTH.map((n) => (
                  <option key={n.v} value={n.v}>
                    {tr(n.az, n.ru, 'option')}
                  </option>
                ))}
              </select>
              <select value={r.on.weekday} onChange={(e) => 'nth' in r.on && onChange({ ...r, on: { ...r.on, weekday: Number(e.target.value) } })}>
                {AZ_WEEKDAYS.map((w, i) => (
                  <option key={i} value={i}>
                    {tr(w, RU_WEEKDAYS[i], 'option')}
                  </option>
                ))}
              </select>
            </div>
          )}
        </>
      )}

      {r.kind === 'after' && (
        <Field label="Gün sayı">
          <input type="number" min={1} value={r.days} onChange={(e) => onChange({ ...r, days: Math.max(1, Number(e.target.value) || 1) })} />
        </Field>
      )}

      <Field label="Başlanğıc">
        <input type="date" value={r.start} onChange={(e) => e.target.value && onChange({ ...r, start: e.target.value })} />
      </Field>
      <p className="hint" style={{ marginTop: -6 }}>→ {describe(r)}</p>
    </>
  );
}
