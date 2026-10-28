import { db } from '../db/db';
import { download, isConnected, upload } from './dropbox';

// Картинки: сжимаются на устройстве, хранятся локально по хешу содержимого,
// в Dropbox лежат как /images/<hash>.<ext>. В markdown на них ссылаются как ![](img:<hash>).

export const IMG_PREFIX = 'img:';
const MAX_SIDE = 1600;

const ext = (mime: string) => (mime === 'image/png' ? 'png' : mime === 'image/webp' ? 'webp' : 'jpg');

async function sha256(b: Blob) {
  const buf = await crypto.subtle.digest('SHA-256', await b.arrayBuffer());
  return [...new Uint8Array(buf)].map((x) => x.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

/** Уменьшить до MAX_SIDE по большей стороне и пережать в JPEG (PNG со прозрачностью остаётся PNG). */
async function compress(file: Blob): Promise<Blob> {
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') return file;
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, MAX_SIDE / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * k);
  const h = Math.round(bmp.height * k);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  const keepPng = file.type === 'image/png' && file.size < 400_000;
  if (!keepPng) {
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
  }
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, keepPng ? 'image/png' : 'image/jpeg', 0.85));
  return out && out.size < file.size ? out : file;
}

/** Сохранить картинку и вернуть её хеш для ссылки в markdown. */
export async function addImage(file: Blob): Promise<string> {
  const data = await compress(file);
  const hash = await sha256(data);
  if (!(await db.blobs.get(hash))) await db.blobs.put({ hash, mime: data.type || 'image/jpeg', data, uploaded: 0 });
  void uploadPending();
  return hash;
}

const urls = new Map<string, string>();
const loading = new Map<string, Promise<string | null>>();

/** URL картинки для <img>: из локального хранилища, а если её нет — скачать из Dropbox. */
export function imageUrl(hash: string): Promise<string | null> {
  const cached = urls.get(hash);
  if (cached) return Promise.resolve(cached);
  if (!loading.has(hash)) {
    loading.set(
      hash,
      (async () => {
        let rec = await db.blobs.get(hash);
        if (!rec && (await isConnected()) && navigator.onLine) {
          for (const e of ['jpg', 'png', 'webp']) {
            try {
              const data = await download(`/images/${hash}.${e}`);
              rec = { hash, mime: data.type || `image/${e === 'jpg' ? 'jpeg' : e}`, data, uploaded: 1 };
              await db.blobs.put(rec);
              break;
            } catch {
              /* пробуем следующее расширение */
            }
          }
        }
        loading.delete(hash);
        if (!rec) return null;
        const url = URL.createObjectURL(rec.data);
        urls.set(hash, url);
        return url;
      })(),
    );
  }
  return loading.get(hash)!;
}

let uploading: Promise<void> | null = null;

/** Выгрузить в Dropbox картинки, которых там ещё нет. */
export function uploadPending(): Promise<void> {
  uploading ??= (async () => {
    try {
      if (!(await isConnected()) || !navigator.onLine) return;
      const pending = await db.blobs.where('uploaded').equals(0).toArray();
      for (const b of pending) {
        await upload(`/images/${b.hash}.${ext(b.mime)}`, b.data);
        await db.blobs.update(b.hash, { uploaded: 1 });
      }
    } finally {
      uploading = null;
    }
  })();
  return uploading;
}

/** Хеши всех картинок, на которые ссылается текст. */
export function imageRefs(md: string): string[] {
  return [...md.matchAll(/!\[[^\]]*\]\(img:([0-9a-f]+)\)/g)].map((m) => m[1]);
}
