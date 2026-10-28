import { App as CapApp } from '@capacitor/app';
import { useEffect, useState, type ReactNode } from 'react';
import { Az } from './i18n/Az';
import { isNative } from './notify/notify';
import { Buta, Icon } from './ui/common';
import { RoutinesScreen, TasksScreen, TodayScreen } from './ui/screens';
import { SettingsScreen } from './ui/Settings';

type Tab = 'today' | 'routines' | 'tasks' | 'settings';
const TABS: { id: Tab; az: string; icon: ReactNode }[] = [
  { id: 'today', az: 'Bu gün', icon: Icon.today },
  { id: 'routines', az: 'Vərdişlər', icon: Icon.routine },
  { id: 'tasks', az: 'Tapşırıqlar', icon: Icon.tasks },
  { id: 'settings', az: 'Ayarlar', icon: Icon.settings },
];

const fromHash = (): Tab => {
  const h = location.hash.slice(1) as Tab;
  return TABS.some((t) => t.id === h) ? h : 'today';
};

export function App() {
  const [tab, setTab] = useState<Tab>(fromHash);

  useEffect(() => {
    const on = () => setTab(fromHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  // Кнопка «назад» на Android: с вкладки — на «Сегодня», с «Сегодня» — свернуть.
  useEffect(() => {
    if (!isNative) return;
    const sub = CapApp.addListener('backButton', () => {
      if (document.querySelector('.sheet-bg')) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
      else if (fromHash() !== 'today') location.hash = 'today';
      else void CapApp.minimizeApp();
    });
    return () => void sub.then((s) => s.remove());
  }, []);

  const go = (t: Tab) => {
    location.hash = t;
    window.scrollTo(0, 0);
  };

  return (
    <div className="app">
      <nav className="nav">
        <div className="brand">
          <Buta className="" />
          Xalça
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
        <main className="main">
          {tab === 'today' && <TodayScreen />}
          {tab === 'routines' && <RoutinesScreen />}
          {tab === 'tasks' && <TasksScreen />}
          {tab === 'settings' && <SettingsScreen />}
        </main>
      </div>
    </div>
  );
}
