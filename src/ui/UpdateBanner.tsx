import { Browser } from '@capacitor/browser';
import { useEffect, useState } from 'react';
import { Az } from '../i18n/Az';
import { applyNow, getUpdateState, onUpdateState, type UpdateState } from '../update/update';

export function UpdateBanner() {
  const [s, setS] = useState<UpdateState>(getUpdateState());
  useEffect(() => {
    const off = onUpdateState(setS);
    return () => void off();
  }, []);
  if (s.status === 'none') return null;
  return (
    <div className="update-banner">
      {s.status === 'ready' ? (
        <>
          <span>
            <Az>Yeniləmə hazırdır</Az>
            {s.notes && <span className="hint"> · {s.notes}</span>}
          </span>
          <button className="btn primary" onClick={() => void applyNow()}>
            <Az>Yenilə</Az>
          </button>
        </>
      ) : (
        <>
          <span>
            <Az>Yeni versiya lazımdır</Az>
          </span>
          {s.apk && (
            <button className="btn primary" onClick={() => void Browser.open({ url: s.apk! })}>
              <Az>Yüklə</Az>
            </button>
          )}
        </>
      )}
    </div>
  );
}
