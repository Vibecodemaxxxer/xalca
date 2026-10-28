import { App as CapApp } from '@capacitor/app';
import { useEffect, useState, type ReactNode } from 'react';
import { Az } from './i18n/Az';
import { useLang } from './i18n/lang';
import { isNative } from './notify/notify';
import { Buta, Icon } from './ui/common';
import { RoutinesScreen, TasksScreen, TodayScreen } from './ui/screens';
import { BazarScreen } from './ui/Bazar';
import { DataProvider } from './ui/data';
import { EventScreen, EventsWatcher } from './ui/Events';
import { GameWatcher, ProfileScreen, RankBadge } from './ui/Game';
import { ProjectsScreen } from './ui/Projects';
import { SettingsScreen } from './ui/Settings';
import { UpdateBanner } from './ui/UpdateBanner';

type Tab = 'today' | 'routines' | 'tasks' | 'projects' | 'settings' | 'profile' | 'event' | 'bazar';
const TABS: { id: Tab; az: string; icon: ReactNode }[] = [
  { id: 'today', az: 'Bu gün', icon: Icon.today },
  { id: 'routines', az: 'Vərdişlər', icon: Icon.routine },
  { id: 'tasks', az: 'Tapşırıqlar', icon: Icon.tasks },
  { id: 'projects', az: 'Layihələr', icon: Icon.projects },
  { id: 'settings', az: 'Ayarlar', icon: Icon.settings },
];

/** #tab или #projects/<id> */
const fromHash = (): { tab: Tab; arg?: string } => {
  const [h, arg] = location.hash.slice(1).split('/') as [Tab, string?];
  // профиль не в меню — открывается по значку сословия
  return TABS.some((t) => t.id === h) || h === 'profile' || h === 'event' || h === 'bazar' ? { tab: h, arg } : { tab: 'today' };
};

export function App() {
  const [{ tab, arg }, setRoute] = useState(fromHash);
  // Строки в placeholder/option берутся через tr() при рендере — при смене языка перерисовываем экран.
  const lang = useLang();

  useEffect(() => {
    const on = () => {
      setRoute(fromHash());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  // Кнопка «назад» на Android: с вкладки — на «Сегодня», с «Сегодня» — свернуть.
  useEffect(() => {
    if (!isNative) return;
    const sub = CapApp.addListener('backButton', () => {
      if (document.querySelector('.sheet-bg')) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      else if (fromHash().arg) history.back();
      else if (fromHash().tab !== 'today') location.hash = 'today';
      else void CapApp.minimizeApp();
    });
    return () => void sub.then((s) => s.remove());
  }, []);

  const go = (t: Tab) => {
    location.hash = t;
  };

  return (
    <DataProvider>
    <div className="app">
      <nav className="nav">
        <div className="brand">
          <Buta className="" />
          Xalça
        </div>
        <div className="nav-rank">
          <RankBadge />
        </div>
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? 'on' : ''} onClick={() => go(t.id)}>
            {t.icon}
            <Az>{t.az}</Az>
          </button>
        ))}
      </nav>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="border-strip" />
        <main className="main" key={lang}>
          <UpdateBanner />
          <GameWatcher />
          <EventsWatcher />
          {tab === 'today' && <TodayScreen />}
          {tab === 'routines' && <RoutinesScreen />}
          {tab === 'tasks' && <TasksScreen />}
          {tab === 'projects' && <ProjectsScreen openId={arg} />}
          {tab === 'settings' && <SettingsScreen />}
          {tab === 'profile' && <ProfileScreen />}
          {tab === 'bazar' && <BazarScreen />}
          {tab === 'event' && arg && <EventScreen runId={arg} />}
        </main>
      </div>
    </div>
    </DataProvider>
  );
}
