import { useState } from 'react';
import { remove, update } from '../db/db';
import type { Reward } from '../db/types';
import { REWARD_IDEAS, shelf, XP_PER_ABBASI } from '../domain/abbasi';
import { buyReward, newReward } from '../domain/ops';
import { Az } from '../i18n/Az';
import { Field, Icon, Sheet } from './common';
import { useData } from './data';

/** Монета abbası (серебро Сефевидов). */
export function Coin({ size = 16 }: { size?: number }) {
  return (
    <svg className="coin" width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10.5" fill="#cfd4dc" stroke="#8b93a1" strokeWidth="1.2" />
      <circle cx="12" cy="12" r="7.6" fill="none" stroke="#8b93a1" strokeWidth=".8" strokeDasharray="1.2 1.1" />
      <path d="M8 13.5c1.2-2.6 2.6-3.6 4-3.6s2.8 1 4 3.6M9.5 10.3h5" stroke="#5f6774" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      <circle cx="12" cy="15.6" r=".9" fill="#5f6774" />
    </svg>
  );
}

export function AbbasiAmount({ n, size }: { n: number; size?: number }) {
  return (
    <span className="abbasi">
      <Coin size={size} />
      {n}
    </span>
  );
}

export function BazarScreen() {
  const { rewards, purchases, abbasi } = useData();
  const [editing, setEditing] = useState<Reward | 'new' | null>(null);
  const [buying, setBuying] = useState<Reward | null>(null);
  const [thanks, setThanks] = useState<string | null>(null);
  const list = shelf(rewards, purchases);
  // Идеи, которых ещё нет среди наград.
  const ideas = REWARD_IDEAS.filter((i) => !rewards.some((r) => r.title === i.title));
  const bought = [...purchases].sort((a, b) => b.at - a.at).slice(0, 30);

  return (
    <>
      <div className="page-head">
        <div>
          <button className="btn ghost back" onClick={() => history.back()}>
            <span className="ico">{Icon.back}</span> <Az>Geri</Az>
          </button>
          <h1>
            <Az>Bazar</Az>
          </h1>
          <div className="sub">
            <Az ru={`1 abbası за каждые ${XP_PER_ABBASI} XP, +50 за значок ивента`} full>
              {`Hər ${XP_PER_ABBASI} XP — 1 abbası`}
            </Az>
          </div>
        </div>
        <div className="balance">
          <AbbasiAmount n={abbasi.balance} size={26} />
        </div>
      </div>

      {thanks && (
        <div className="bought" onAnimationEnd={() => setThanks(null)}>
          <Az ru="На здоровье! Заслужил.">Xeyirli olsun!</Az> · {thanks}
        </div>
      )}

      {list.length > 0 && (
        <div className="shelf">
          {list.map((r) => {
            const can = abbasi.balance >= r.price;
            return (
              <div key={r.id} className={`reward${can ? '' : ' locked'}`}>
                <div className="body" onClick={() => setEditing(r)}>
                  <div className="title">{r.title}</div>
                  <div className="meta">
                    <AbbasiAmount n={r.price} />
                    {!r.repeatable && (
                      <span>
                        · <Az ru="один раз">bir dəfəlik</Az>
                      </span>
                    )}
                    {!can && <span>· ещё {r.price - abbasi.balance}</span>}
                  </div>
                </div>
                <button className="btn primary" disabled={!can} onClick={() => setBuying(r)}>
                  <Az ru="Купить">Al</Az>
                </button>
              </div>
            );
          })}
        </div>
      )}

      {ideas.length > 0 && (
        <section className="section">
          <h2>
            <Az ru="Идеи наград — нажми, чтобы добавить">Fikirlər</Az>
          </h2>
          <div className="seg">
            {ideas.map((i) => (
              <button key={i.title} onClick={() => void newReward(i)}>
                {i.title} · {i.price}
              </button>
            ))}
          </div>
        </section>
      )}

      <button className="btn" style={{ marginTop: 12 }} onClick={() => setEditing('new')}>
        + <Az ru="Новая награда">Yeni mükafat</Az>
      </button>

      {bought.length > 0 && (
        <section className="section">
          <h2>
            <Az ru="Покупки">Alınanlar</Az> <span className="count">· {abbasi.spent}</span>
          </h2>
          <div className="list">
            {bought.map((p) => (
              <div key={p.id} className="row sub purchase">
                <div className="body">
                  <div className="title">{p.title}</div>
                  <div className="meta">{new Date(p.at).toLocaleDateString('ru', { day: 'numeric', month: 'long' })}</div>
                </div>
                <AbbasiAmount n={p.price} />
                <button className="btn ghost" onClick={() => confirm(`Отменить покупку «${p.title}»? ${p.price} abbası вернутся.`) && void remove('purchases', p.id)} aria-label="Отменить покупку">
                  ↶
                </button>
              </div>
            ))}
          </div>
        </section>
      )}


      {buying && (
        <Sheet title={<Az ru="Купить?">Alırsan?</Az>} onClose={() => setBuying(null)}>
          <p className="buy-q">
            <b>{buying.title}</b> за <AbbasiAmount n={buying.price} />
            <br />
            <span className="hint">
              Останется: <AbbasiAmount n={abbasi.balance - buying.price} />
            </span>
          </p>
          <div className="actions">
            <span className="spacer" />
            <button className="btn ghost" onClick={() => setBuying(null)}>
              <Az>Ləğv et</Az>
            </button>
            <button
              className="btn primary"
              onClick={async () => {
                await buyReward(buying);
                setThanks(buying.title);
                setBuying(null);
              }}
            >
              <Az ru="Купить">Al</Az>
            </button>
          </div>
        </Sheet>
      )}
      {editing && <RewardSheet reward={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
    </>
  );
}

function RewardSheet({ reward, onClose }: { reward?: Reward; onClose: () => void }) {
  const [title, setTitle] = useState(reward?.title ?? '');
  const [price, setPrice] = useState(reward?.price ?? 30);
  const [repeatable, setRepeatable] = useState(reward?.repeatable ?? true);

  const save = async () => {
    if (!title.trim()) return;
    const fields = { title: title.trim(), price: Math.max(1, Math.round(price)), repeatable };
    if (reward) await update<Reward>('rewards', reward.id, fields);
    else await newReward(fields);
    onClose();
  };

  return (
    <Sheet title={<Az ru={reward ? 'Награда' : 'Новая награда'}>{reward ? 'Mükafat' : 'Yeni mükafat'}</Az>} onClose={onClose}>
      <form onSubmit={(e) => (e.preventDefault(), save())}>
        <Field label="Başlıq">
          <input type="text" autoFocus={!reward} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Серия сериала, пицца, новая книга…" />
        </Field>
        <Field label="Qiymət">
          <input type="number" min={1} value={price} onChange={(e) => setPrice(Number(e.target.value) || 1)} />
        </Field>
        <label className="field" style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <input type="checkbox" checked={repeatable} onChange={(e) => setRepeatable(e.target.checked)} />
          <Az ru="Можно покупать много раз">Təkrar alına bilər</Az>
        </label>
        <div className="actions">
          {reward && (
            <button type="button" className="btn danger ghost" onClick={() => confirm('Удалить награду? Покупки останутся в истории.') && void remove('rewards', reward.id).then(onClose)}>
              <Az>Sil</Az>
            </button>
          )}
          <span className="spacer" />
          <button type="button" className="btn ghost" onClick={onClose}>
            <Az>Ləğv et</Az>
          </button>
          <button type="submit" className="btn primary" disabled={!title.trim()}>
            <Az>Saxla</Az>
          </button>
        </div>
      </form>
    </Sheet>
  );
}
