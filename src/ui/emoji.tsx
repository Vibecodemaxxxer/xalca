import { useState } from 'react';
import { Az } from '../i18n/Az';
import { Sheet } from './common';

// Подборка эмодзи для задач — без тяжёлой библиотеки, по категориям, как в Notion.
const CATEGORIES: { az: string; ru: string; icon: string; list: string }[] = [
  { az: 'İşlər', ru: 'Дела', icon: '✅', list: '✅ 📌 📝 📋 📎 📅 ⏰ 🔔 🎯 🏁 🚀 💡 🔥 ⭐ ✨ ⚡ 🧠 🧩 🔧 🛠️ 🔑 📦 📈 📊 💼 🗂️ 📁 🖊️ ✏️ 📚 📖 🎓' },
  { az: 'Ev', ru: 'Дом', icon: '🏠', list: '🏠 🛋️ 🛏️ 🧹 🧺 🧼 🪴 🔨 🪛 🧱 🚿 🍳 🛒 🧾 💳 💰 🏦 🚗 ⛽ 🚌 ✈️ 🧳 📮 🐈 🐕 👶 👨‍👩‍👧 🎁' },
  { az: 'Sağlamlıq', ru: 'Здоровье', icon: '💪', list: '💪 🏃 🚴 🏊 🧘 🏋️ ⚽ 🏀 🎾 🥊 🧗 🚶 💊 🩺 🦷 😴 💧 🥗 🍎 🥦 🍵 ☕ 🚭 ❤️ 🧠' },
  { az: 'Yemək', ru: 'Еда', icon: '🍽️', list: '🍽️ 🍞 🥐 🧀 🥚 🥩 🍗 🍖 🐟 🍚 🍝 🍕 🍔 🥙 🌯 🥟 🍲 🥘 🍰 🍪 🍫 🍯 🍉 🍇 🍒 🍋 🍅 🥕 🧅 🍋‍🟩' },
  { az: 'İstirahət', ru: 'Отдых', icon: '🎉', list: '🎉 🎂 🎬 🎮 🎧 🎵 🎸 🎨 📷 🎭 🎤 🎲 ♟️ 🧶 📺 🏖️ ⛰️ 🏕️ 🌍 🗺️ 🎟️ 🍿 🛍️ 💃' },
  { az: 'Təbiət', ru: 'Природа', icon: '🌿', list: '🌿 🌱 🌳 🌸 🌻 🌷 🍁 🍂 ☀️ 🌙 ⭐ 🌈 ☁️ 🌧️ ❄️ 🌊 🔥 🌋 🐦 🦋 🐝 🐞 🐢 🦁' },
  { az: 'Azərbaycan', ru: 'Азербайджан', icon: '🇦🇿', list: '🇦🇿 🫖 🍵 🧿 🌰 🍑 🍈 🪔 🕌 🏛️ 🔥 🌾 🐎 🎻 🥁 🪕 🧵 🕊️ 🌹' },
  { az: 'Simvollar', ru: 'Символы', icon: '❗', list: '❗ ❓ ⚠️ 🚫 ✔️ ❌ ➕ ➖ 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🔺 🔻 💯 🆕 🆗 🔝 ♻️ ⏳ 🕐' },
];

const RECENT = 'xalca.emoji.recent';
function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT) ?? '[]');
  } catch {
    return [];
  }
}

/** Выбор эмодзи: недавние сверху, затем категории. */
export function EmojiPicker({ value, onPick, onClose }: { value?: string | null; onPick: (e: string | null) => void; onClose: () => void }) {
  const [cat, setCat] = useState(0);
  const recent = loadRecent();
  const pick = (e: string | null) => {
    if (e) {
      try {
        localStorage.setItem(RECENT, JSON.stringify([e, ...recent.filter((x) => x !== e)].slice(0, 16)));
      } catch {
        /* не запоминаем */
      }
    }
    onPick(e);
    onClose();
  };
  return (
    <Sheet onClose={onClose}>
      <div className="emoji-head">
        <span className="emoji-cur">{value || '☺'}</span>
        {value && (
          <button className="btn ghost" onClick={() => pick(null)}>
            <Az ru="Убрать">Sil</Az>
          </button>
        )}
      </div>
      {recent.length > 0 && (
        <div className="emoji-grid recent">
          {recent.map((e) => (
            <button key={e} onClick={() => pick(e)}>
              {e}
            </button>
          ))}
        </div>
      )}
      <div className="emoji-tabs">
        {CATEGORIES.map((c, i) => (
          <button key={c.az} className={cat === i ? 'on' : ''} onClick={() => setCat(i)} title={c.ru}>
            {c.icon}
          </button>
        ))}
      </div>
      <div className="emoji-cat">
        <Az ru={CATEGORIES[cat].ru} full>
          {CATEGORIES[cat].az}
        </Az>
      </div>
      <div className="emoji-grid">
        {CATEGORIES[cat].list.split(' ').map((e) => (
          <button key={e} className={value === e ? 'on' : ''} onClick={() => pick(e)}>
            {e}
          </button>
        ))}
      </div>
    </Sheet>
  );
}
