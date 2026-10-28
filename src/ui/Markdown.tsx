import { lazy, Suspense, useEffect, useState } from 'react';
import ReactMarkdown, { defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { toggleCheckbox } from '../lib/md';
import { IMG_PREFIX, imageUrl } from '../sync/images';
import type { RichEditor as RichEditorType } from './RichEditor';

// Редактор тяжёлый — грузим отдельным файлом, когда он впервые нужен.
const LazyEditor = lazy(() => import('./RichEditor').then((m) => ({ default: m.RichEditor })));

/** Визуальный редактор с ленивой загрузкой. */
export function RichEditor(props: Parameters<typeof RichEditorType>[0]) {
  return (
    <Suspense fallback={<div className="md-preview hint">…</div>}>
      <LazyEditor {...props} />
    </Suspense>
  );
}

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

/** Поле описания — визуальный редактор как в Notion (старое имя оставлено для прежних импортов). */
export function MdEditor({ value, onChange }: { value: string; onChange: (v: string) => void; startInPreview?: boolean }) {
  return <RichEditor value={value} onChange={onChange} />;
}
