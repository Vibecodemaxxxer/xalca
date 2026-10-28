import { Browser } from '@capacitor/browser';
import { useEffect, useState } from 'react';
import { getMeta, setMeta } from '../db/db';
import { Az } from '../i18n/Az';
import { isNative, permissionState, requestPermission } from '../notify/notify';
import { authUrl, disconnect, finishAuth, getAppKey, isConnected, setAppKey } from '../sync/dropbox';
import { APP_VERSION, checkForUpdate, lastCheck, onUpdateState } from '../update/update';
import { getSyncState, onSyncState, syncNow, type SyncState } from '../sync/sync';

export function useSyncState() {
  const [s, setS] = useState<SyncState>(getSyncState());
  useEffect(() => {
    const off = onSyncState(setS);
    return () => void off();
  }, []);
  return s;
}

export type Theme = 'auto' | 'light' | 'dark';
export function applyTheme(t: Theme) {
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
}

export function SettingsScreen() {
  return (
    <>
      <div className="page-head">
        <h1>
          <Az>Ayarlar</Az>
        </h1>
      </div>
      <DropboxCard />
      <NotifyCard />
      <ThemeCard />
      {isNative ? (
        <UpdatesCard />
      ) : (
        <p className="hint" style={{ textAlign: 'center', marginTop: 24 }}>
          <Az>Versiya</Az> {APP_VERSION}
        </p>
      )}
    </>
  );
}

function UpdatesCard() {
  const [, rerender] = useState(0);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const off = onUpdateState(() => rerender((n) => n + 1));
    return () => void off();
  }, []);
  const at = lastCheck && new Date(lastCheck.at).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="card">
      <h3>
        <Az>Yeniləmələr</Az>
      </h3>
      <p className="hint" style={{ margin: 0 }}>
        <Az>Versiya</Az> {APP_VERSION}
        {lastCheck && (
          <>
            <br />
            {at}: {lastCheck.result}
          </>
        )}
      </p>
      <button
        className="btn"
        style={{ marginTop: 10 }}
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          await checkForUpdate();
          setBusy(false);
        }}
      >
        <Az>Yoxla</Az>
      </button>
    </div>
  );
}

function DropboxCard() {
  const sync = useSyncState();
  const [connected, setConnected] = useState<boolean | null>(null);
  const [key, setKey] = useState('');
  const [step, setStep] = useState<'key' | 'code'>('key');
  const [code, setCode] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    void isConnected().then(setConnected);
    void getAppKey().then(setKey);
  }, [sync.status]);

  const open = async () => {
    setErr('');
    await setAppKey(key);
    const url = await authUrl();
    if (isNative) await Browser.open({ url });
    else window.open(url, '_blank');
    setStep('code');
  };

  const finish = async () => {
    setErr('');
    try {
      await finishAuth(code);
      setConnected(true);
      setCode('');
      setStep('key');
      await syncNow();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  const last = sync.lastSync ? new Date(sync.lastSync).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }) : null;

  return (
    <div className="card">
      <h3>
        <Az>Sinxronizasiya</Az> · Dropbox
      </h3>
      {connected ? (
        <>
          <div className="status">
            <span className={`dot ${sync.status}`} />
            {sync.status === 'syncing' ? 'синхронизация…' : sync.status === 'error' ? 'ошибка' : last ? `последняя: ${last}` : 'подключено'}
          </div>
          {sync.error && <p className="err">{sync.error}</p>}
          <div className="actions" style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button className="btn" onClick={() => void syncNow()} disabled={sync.status === 'syncing'}>
              <Az>İndi sinxronlaşdır</Az>
            </button>
            <button
              className="btn danger ghost"
              onClick={async () => {
                if (!confirm('Отключить Dropbox на этом устройстве? Данные на устройстве останутся.')) return;
                await disconnect();
                setConnected(false);
              }}
            >
              <Az>Ayrıl</Az>
            </button>
          </div>
        </>
      ) : step === 'key' ? (
        <>
          <p className="hint">Данные хранятся на устройстве и синхронизируются через твой Dropbox (отдельная папка приложения).</p>
          <details>
            <summary className="hint" style={{ cursor: 'pointer' }}>Где взять App key (один раз)</summary>
            <ol className="hint">
              <li>
                Открой <a href="https://www.dropbox.com/developers/apps" target="_blank" rel="noreferrer">dropbox.com/developers/apps</a> → <b>Create app</b>
              </li>
              <li>
                <b>Scoped access</b> → <b>App folder</b> → любое имя, например <code>Xalca-мойник</code>
              </li>
              <li>
                Вкладка <b>Permissions</b>: отметь <code>files.metadata.read</code>, <code>files.content.write</code>, <code>files.content.read</code> → <b>Submit</b>
              </li>
              <li>
                Вкладка <b>Settings</b>: скопируй <b>App key</b>
              </li>
            </ol>
          </details>
          <div className="field" style={{ marginTop: 10 }}>
            <span>App key</span>
            <input type="text" value={key} onChange={(e) => setKey(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
          </div>
          <button className="btn primary" disabled={!key.trim()} onClick={() => void open()}>
            <Az>Qoşul</Az>
          </button>
        </>
      ) : (
        <>
          <p className="hint">На открывшейся странице Dropbox нажми «Разрешить» и скопируй код сюда.</p>
          <div className="field">
            <input type="text" placeholder="Код из Dropbox" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="off" autoCorrect="off" spellCheck={false} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn ghost" onClick={() => setStep('key')}>
              <Az>Ləğv et</Az>
            </button>
            <button className="btn primary" disabled={!code.trim()} onClick={() => void finish()}>
              <Az>Qoşul</Az>
            </button>
          </div>
        </>
      )}
      {err && <p className="err">{err}</p>}
    </div>
  );
}

function NotifyCard() {
  const [perm, setPerm] = useState<string>('…');
  const refresh = () => void permissionState().then(setPerm);
  useEffect(refresh, []);
  return (
    <div className="card">
      <h3>
        <Az>Xatırlatmalar</Az>
      </h3>
      {perm === 'granted' ? (
        <p className="hint">Уведомления включены.{!isNative && ' На ПК напоминания приходят, пока приложение открыто (можно свернуть).'}</p>
      ) : perm === 'denied' ? (
        <p className="err">Уведомления запрещены — разреши их в настройках {isNative ? 'Android для приложения' : 'браузера для сайта'}.</p>
      ) : (
        <button className="btn primary" onClick={() => void requestPermission().then(refresh)}>
          Разрешить уведомления
        </button>
      )}
      {isNative && (
        <details style={{ marginTop: 10 }}>
          <summary className="hint" style={{ cursor: 'pointer' }}>Чтобы MIUI / HyperOS не глушил напоминания</summary>
          <ol className="hint">
            <li>Настройки → Приложения → Xalça → <b>Автозапуск</b>: включить</li>
            <li>Там же → <b>Контроль активности</b> (батарея): «Нет ограничений»</li>
            <li>Уведомления → разрешить всплывающие и на экране блокировки</li>
          </ol>
        </details>
      )}
    </div>
  );
}

function ThemeCard() {
  const [theme, setTheme] = useState<Theme>('auto');
  useEffect(() => void getMeta<Theme>('theme').then((t) => t && setTheme(t)), []);
  const pick = (t: Theme) => {
    setTheme(t);
    applyTheme(t);
    void setMeta('theme', t);
  };
  return (
    <div className="card">
      <h3>
        <Az>Görünüş</Az>
      </h3>
      <div className="seg">
        {(
          [
            ['auto', 'Avto', 'Как в системе'],
            ['light', 'Açıq', 'Светлая'],
            ['dark', 'Tünd', 'Тёмная'],
          ] as const
        ).map(([v, az, ru]) => (
          <button key={v} className={theme === v ? 'on' : ''} onClick={() => pick(v)}>
            <Az ru={ru}>{az}</Az>
          </button>
        ))}
      </div>
    </div>
  );
}
