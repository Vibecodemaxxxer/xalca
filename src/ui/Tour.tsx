import { useEffect, useState, type ReactNode } from 'react';
import { getMeta, setMeta } from '../db/db';
import { Az } from '../i18n/Az';
import { Coin } from './Bazar';
import { Buta, Icon } from './common';
import { Semeni } from './Game';
import { Armudu } from './Tea';

// Обучение: короткий тур карточками. Показывается при первом запуске и по кнопке в настройках.

const OPEN_EVENT = 'xalca:tour';
export const openTour = () => window.dispatchEvent(new Event(OPEN_EVENT));

interface Step {
  art: ReactNode;
  az: string;
  ru: string;
  body: ReactNode;
}

const big = (icon: ReactNode, color: string) => (
  <div className="tour-icon" style={{ background: `color-mix(in srgb, ${color} 16%, var(--surface))`, color }}>
    {icon}
  </div>
);

const STEPS: Step[] = [
  {
    art: <Buta className="tour-buta" />,
    az: 'Xoş gəldin!',
    ru: 'Добро пожаловать!',
    body: (
      <>
        Xalça — трекер задач, привычек и проектов с азербайджанским характером.
        <br />
        <br />
        Азербайджанские слова переводятся: <b>тап по тексту</b> или наведение на ПК, а на кнопках — <b>долгое нажатие</b>. Язык можно сменить в настройках.
      </>
    ),
  },
  {
    art: big(Icon.today, 'var(--brand)'),
    az: 'Bu gün',
    ru: 'Сегодня',
    body: (
      <>
        Всё на сегодня: просроченное, привычки и задачи. Задача добавляется одной строкой — дата, время, проект и размер распознаются сами:
        <div className="tour-demo">
          <div className="tour-input">Позвонить врачу завтра 10:00 #ремонт !</div>
          <div className="parsed">
            <span>10:00</span>
            <span>Завтра</span>
            <span className="project">Ремонт</span>
            <span className="size">большая +25</span>
          </div>
        </div>
      </>
    ),
  },
  {
    art: big(Icon.tasks, 'var(--blue)'),
    az: 'Tapşırıq',
    ru: 'Задача',
    body: (
      <>
        Тап по задаче — карточка. Всё настраивается кнопками и сохраняется само:
        <div className="tour-demo props">
          <span className="prop set">{Icon.today} Sabah</span>
          <span className="prop">{Icon.projects} Layihə</span>
          <span className="prop big">★ Böyük +25</span>
        </div>
        Размер решает награду: маленькая +5, обычная +10, большая +25. Внутри — подзадачи и описание как в Notion: кнопки для жирного, заголовков, списков, чек-листов и картинок.
      </>
    ),
  },
  {
    art: big(Icon.inbox, 'var(--gold-dk)'),
    az: 'Saxlanılanlar',
    ru: 'Избранное',
    body: (
      <>
        Как «Избранное» в Telegram: кидай мысли, ссылки, картинки, #теги — без всяких настроек.
        <br />
        <br />
        Потом жми <b>«Səliqəyə sal»</b> — сообщения пойдут по одному: в задачу, в проект, оставить или удалить. За каждое разобранное — опыт.
      </>
    ),
  },
  {
    art: big(Icon.projects, 'var(--green)'),
    az: 'Layihələr',
    ru: 'Проекты',
    body: (
      <>
        Проект — дерево задач любой глубины, с заметками и прогрессом. Цель задачи может быть «по подзадачам» — тогда она закроется сама.
        <br />
        <br />
        Закрыл все задачи — <b>заверши проект</b> и получи бонус: половину наград за его задачи.
      </>
    ),
  },
  {
    art: (
      <div className="tour-icon" style={{ background: 'color-mix(in srgb, var(--green) 14%, var(--surface))' }}>
        <Semeni streak={14} everDone size={64} />
      </div>
    ),
    az: 'Vərdişlər',
    ru: 'Привычки',
    body: (
      <>
        Любые повторы: каждый день, «вт, чт, сб», раз в N дней, последняя пятница месяца, через N дней после выполнения. Напоминания приходят даже при закрытом приложении.
        <br />
        <br />
        Стрик растит <b>səməni</b> — пропустишь, и росток подвянет.
      </>
    ),
  },
  {
    art: big(Icon.repeat, 'var(--blue)'),
    az: 'Görünüşlər',
    ru: 'Виды',
    body: (
      <>
        На вкладке задач — три вида: <b>Siyahı</b> (список), <b>Təqvim</b> (календарь, на ПК задачи перетаскиваются по дням) и <b>Lövhə</b> (канбан: «нужно — в работе — готово»).
      </>
    ),
  },
  {
    art: (
      <div className="tour-icon" style={{ background: 'color-mix(in srgb, var(--gold) 18%, var(--surface))' }}>
        <Coin size={64} />
      </div>
    ),
    az: 'Rütbə, xalça, abbası',
    ru: 'Сословие, ковёр, abbası',
    body: (
      <>
        За дела — опыт и путь по сословиям: от <b>Rəiyyət</b> до <b>Şah</b>. Каждый день вплетается рядом в <b>ковёр месяца</b>.
        <br />
        <br />
        Опыт превращается в монеты <b>abbası</b> — трать их на свои награды в <b>Bazar</b>. Всё это — в профиле, по тапу на значок сословия.
      </>
    ),
  },
  {
    art: (
      <div className="tour-icon" style={{ background: 'color-mix(in srgb, var(--brand) 12%, var(--surface))', color: 'var(--text)' }}>
        <Armudu level={0.7} size={70} steam />
      </div>
    ),
    az: 'Hazırsan!',
    ru: 'Готово!',
    body: (
      <>
        Ещё есть <b>çay fasiləsi</b> — помодоро со стаканом армуду (кнопка на «Bu gün»).
        <br />
        <br />
        Синхронизация между ПК и телефоном — через Dropbox, в настройках. Там же можно пройти этот тур снова.
      </>
    ),
  },
];

export function Tour() {
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  useEffect(() => {
    // первый запуск на устройстве
    void getMeta<boolean>('tour.done').then((done) => !done && setOpen(true));
    const on = () => (setI(0), setOpen(true));
    window.addEventListener(OPEN_EVENT, on);
    return () => window.removeEventListener(OPEN_EVENT, on);
  }, []);

  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((x) => Math.min(x + 1, STEPS.length - 1));
      if (e.key === 'ArrowLeft') setI((x) => Math.max(x - 1, 0));
      if (e.key === 'Escape') close();
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [open]);

  const close = () => {
    setOpen(false);
    void setMeta('tour.done', true);
  };

  if (!open) return null;
  const s = STEPS[i];
  const last = i === STEPS.length - 1;

  return (
    <div className="tour" role="dialog" aria-label="Обучение">
      <div className="tour-top">
        <div className="tour-progress">
          <i style={{ width: `${((i + 1) / STEPS.length) * 100}%` }} />
        </div>
        {!last && (
          <button className="btn ghost" onClick={close}>
            <Az ru="Пропустить">Keç</Az>
          </button>
        )}
      </div>
      <div className="tour-card" key={i}>
        <div className="tour-art">{s.art}</div>
        <h2>
          <Az ru={s.ru} full>
            {s.az}
          </Az>
        </h2>
        <div className="tour-body">{s.body}</div>
      </div>
      <div className="tour-nav">
        {i > 0 && (
          <button className="btn" onClick={() => setI(i - 1)}>
            <span className="ico">{Icon.back}</span>
          </button>
        )}
        <button className="btn primary tour-next" onClick={() => (last ? close() : setI(i + 1))}>
          <Az ru={last ? 'Начать' : 'Дальше'} full>
            {last ? 'Başla' : 'Davam et'}
          </Az>
        </button>
      </div>
    </div>
  );
}
