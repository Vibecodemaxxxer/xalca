import { useEffect, useRef, useState, type ClipboardEvent } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Az } from '../i18n/Az';
import { toggleCheckbox } from '../lib/md';
import { addImage, IMG_PREFIX, imageUrl } from '../sync/images';
import { Icon } from './common';

/** Картинка из локального хранилища / Dropbox по ссылке img:<hash>. */
function StoredImage({ hash, alt }: { hash: string; alt?: string }) {
  const [url, setUrl] = useState<string | null | undefined>();
  useEffect(() => {
    let alive = true;
    void imageUrl(hash).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [hash]);
  if (url === undefined) return <span className="img-ph">…</span>;
  if (url === null) return <span className="img-ph">картинка ещё не загружена</span>;
  return <img src={url} alt={alt ?? ''} onClick={() => window.open(url, '_blank')} />;
}

export function Markdown({ source, onChange }: { source: string; onChange?: (md: string) => void }) {
  let box = 0;
  return (
    <div className="md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => (url.startsWith(IMG_PREFIX) ? url : defaultUrlTransform(url))}
        components={{
          img: ({ src, alt }) =>
            typeof src === 'string' && src.startsWith(IMG_PREFIX) ? <StoredImage hash={src.slice(IMG_PREFIX.length)} alt={alt} /> : <img src={src as string} alt={alt ?? ''} />,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          input: ({ type, checked }) => {
            if (type !== 'checkbox') return <input type={type} />;
            const n = box++;
            return (
              <input
                type="checkbox"
                checked={!!checked}
                disabled={!onChange}
                onChange={() => onChange?.(toggleCheckbox(source, n))}
                onClick={(e) => e.stopPropagation()}
              />
            );
          },
        }}
      >
        {source}
      </ReactMarkdown>
    </div>
  );
}

/** Поле описания: «Yaz» (писать) / «Bax» (смотреть), вставка картинок из буфера и из файла/камеры. */
export function MdEditor({ value, onChange, startInPreview }: { value: string; onChange: (v: string) => void; startInPreview?: boolean }) {
  const [preview, setPreview] = useState(!!startInPreview && !!value.trim());
  const [busy, setBusy] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const file = useRef<HTMLInputElement>(null);
  const valueRef = useRef(value);
  valueRef.current = value;

  const insertImages = async (files: Blob[]) => {
    if (!files.length) return;
    setBusy(true);
    try {
      const refs: string[] = [];
      for (const f of files) refs.push(`![](${IMG_PREFIX}${await addImage(f)})`);
      const text = refs.join('\n');
      const cur = valueRef.current;
      const el = ta.current;
      // В позицию курсора — только если пользователь реально в поле; иначе в конец.
      const pos = el && !preview && document.activeElement === el ? el.selectionStart : cur.length;
      const before = cur.slice(0, pos);
      const sep = before && !before.endsWith('\n') ? '\n' : '';
      onChange(`${before}${sep}${text}\n${cur.slice(pos)}`);
    } finally {
      setBusy(false);
    }
  };

  const onPaste = (e: ClipboardEvent) => {
    const imgs = [...e.clipboardData.items].filter((i) => i.type.startsWith('image/')).map((i) => i.getAsFile()!).filter(Boolean);
    if (imgs.length) {
      e.preventDefault();
      void insertImages(imgs);
    }
  };

  return (
    <div className="md-editor">
      <div className="md-tools">
        <div className="seg">
          <button type="button" className={!preview ? 'on' : ''} onClick={() => setPreview(false)}>
            <Az>Yaz</Az>
          </button>
          <button type="button" className={preview ? 'on' : ''} onClick={() => setPreview(true)}>
            <Az>Bax</Az>
          </button>
        </div>
        <button type="button" className="btn ghost" disabled={busy} onClick={() => file.current?.click()}>
          <span className="ico">{busy ? Icon.sync : Icon.image}</span> <Az>Şəkil</Az>
        </button>
        <input
          ref={file}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void insertImages([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
      </div>
      {preview ? (
        <div className="md-preview" onDoubleClick={() => setPreview(false)}>
          {value.trim() ? <Markdown source={value} onChange={onChange} /> : <span className="hint">Пусто</span>}
        </div>
      ) : (
        <textarea
          ref={ta}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onPaste={onPaste}
          placeholder={'Markdown: **жирный**, *курсив*, - список, - [ ] галочка, # заголовок'}
        />
      )}
    </div>
  );
}
