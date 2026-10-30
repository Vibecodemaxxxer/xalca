import { getMeta, setMeta } from '../db/db';

// Авторизация Dropbox по OAuth PKCE без redirect: пользователь копирует код со страницы Dropbox.
// Так одинаково работает и в браузере, и в Android-приложении, секретов в коде нет.

interface Tokens {
  access: string;
  refresh: string;
  expiresAt: number;
}

const TOKENS = 'dropbox.tokens';
const VERIFIER = 'dropbox.verifier';
const APP_KEY = 'dropbox.appKey';

export async function getAppKey(): Promise<string> {
  return (await getMeta<string>(APP_KEY)) || import.meta.env.VITE_DROPBOX_APP_KEY || '';
}

export const setAppKey = (key: string) => setMeta(APP_KEY, key.trim());

export async function isConnected() {
  return !!(await getMeta<Tokens>(TOKENS));
}

export async function disconnect() {
  await setMeta(TOKENS, null);
}

function b64url(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function authUrl(): Promise<string> {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  await setMeta(VERIFIER, verifier);
  const challenge = b64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  const q = new URLSearchParams({
    client_id: await getAppKey(),
    response_type: 'code',
    code_challenge: challenge,
    code_challenge_method: 'S256',
    token_access_type: 'offline',
  });
  return `https://www.dropbox.com/oauth2/authorize?${q}`;
}

async function tokenRequest(params: Record<string, string>) {
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    body: new URLSearchParams({ client_id: await getAppKey(), ...params }),
  });
  if (!res.ok) throw new Error(`Dropbox: ${res.status} ${await res.text()}`);
  return res.json() as Promise<{ access_token: string; refresh_token?: string; expires_in: number }>;
}

export async function finishAuth(code: string) {
  const verifier = await getMeta<string>(VERIFIER);
  if (!verifier) throw new Error('Сначала откройте страницу авторизации');
  const r = await tokenRequest({ grant_type: 'authorization_code', code: code.trim(), code_verifier: verifier });
  await setMeta(TOKENS, { access: r.access_token, refresh: r.refresh_token!, expiresAt: Date.now() + r.expires_in * 1000 } satisfies Tokens);
}

async function accessToken(): Promise<string> {
  const t = await getMeta<Tokens>(TOKENS);
  if (!t) throw new Error('Dropbox не подключён');
  if (Date.now() < t.expiresAt - 60_000) return t.access;
  const r = await tokenRequest({ grant_type: 'refresh_token', refresh_token: t.refresh });
  const next = { ...t, access: r.access_token, expiresAt: Date.now() + r.expires_in * 1000 };
  await setMeta(TOKENS, next);
  return next.access;
}

// Запрос, повисший при засыпании устройства, не должен навсегда занять синхронизацию.
const TIMEOUT = 120_000;

async function call(url: string, init: RequestInit): Promise<Response> {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${await accessToken()}`, ...init.headers },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  if (!res.ok) throw new DropboxError(res.status, await res.text());
  return res;
}

export class DropboxError extends Error {
  constructor(public status: number, public body: string) {
    super(`Dropbox ${status}: ${body.slice(0, 200)}`);
  }
}

// Dropbox-API-Arg должен быть ASCII: экранируем не-ASCII символы.
const arg = (o: object) => JSON.stringify(o).replace(/[\u007f-￿]/g, (c) => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));

export interface Entry {
  name: string;
  path: string;
  rev: string;
}

export async function listFolder(path: string): Promise<Entry[]> {
  try {
    const res = await call('https://api.dropboxapi.com/2/files/list_folder', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path }),
    });
    const out: Entry[] = [];
    let data = await res.json();
    for (;;) {
      for (const e of data.entries) if (e['.tag'] === 'file') out.push({ name: e.name, path: e.path_lower, rev: e.rev });
      if (!data.has_more) break;
      data = await (
        await call('https://api.dropboxapi.com/2/files/list_folder/continue', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cursor: data.cursor }),
        })
      ).json();
    }
    return out;
  } catch (e) {
    // Папки ещё нет — первый запуск.
    if (e instanceof DropboxError && e.status === 409 && e.body.includes('not_found')) return [];
    throw e;
  }
}

export async function download(path: string): Promise<Blob> {
  const res = await call('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: { 'Dropbox-API-Arg': arg({ path }) },
  });
  return res.blob();
}

export async function upload(path: string, data: Blob | string) {
  await call('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': arg({ path, mode: 'overwrite', mute: true }),
    },
    body: data,
  });
}
