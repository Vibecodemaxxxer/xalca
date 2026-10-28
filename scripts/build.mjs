// Сборка для публикации.
//   node scripts/build.mjs pages   — сайт для GitHub Pages (PWA для ПК + пакет автообновления Android)
//   node scripts/build.mjs native  — веб-часть для APK (перед `cap sync android`)
//
// Адрес сайта берётся из UPDATE_URL или из GITHUB_REPOSITORY (в GitHub Actions).
import { execSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';

const mode = process.argv[2];
const repo = process.env.GITHUB_REPOSITORY; // owner/name
const updateUrl =
  process.env.UPDATE_URL ||
  (repo ? `https://${repo.split('/')[0].toLowerCase()}.github.io/${repo.split('/')[1]}/` : readSiteUrl());
const pagesBase = new URL(updateUrl).pathname;

const run = (cmd, env = {}) => execSync(cmd, { stdio: 'inherit', env: { ...process.env, ...env } });

function readSiteUrl() {
  try {
    return readFileSync('site-url.txt', 'utf8').trim();
  } catch {
    throw new Error('Нет адреса сайта: задайте UPDATE_URL или создайте site-url.txt');
  }
}

/** versionCode Android-приложения: обновление ставится только на APK не старше этого. */
function nativeVersion() {
  const m = readFileSync('android/app/build.gradle', 'utf8').match(/versionCode\s+(\d+)/);
  return Number(m[1]);
}

function version() {
  if (process.env.APP_VERSION) return process.env.APP_VERSION;
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

const v = version();
const env = { VITE_APP_VERSION: v, VITE_UPDATE_URL: updateUrl };

if (mode === 'native') {
  run('npx vite build', { ...env, BASE: '/' });
} else if (mode === 'pages') {
  rmSync('build', { recursive: true, force: true });
  // 1. Бандл для Android (base '/'), упакованный в zip.
  run('npx vite build --outDir build/native', { ...env, BASE: '/' });
  // 2. Сайт-PWA для ПК.
  run(`npx vite build --outDir build/pages`, { ...env, BASE: pagesBase });
  mkdirSync('build/pages/update', { recursive: true });
  const zip = `bundle-${v}.zip`;
  run(`cd build/native && zip -qr ../pages/update/${zip} .`);
  if (existsSync('release/Xalca.apk')) cpSync('release/Xalca.apk', 'build/pages/Xalca.apk');
  let notes = process.env.UPDATE_NOTES;
  if (!notes) {
    try {
      notes = execSync('git log -1 --format=%s').toString().trim();
    } catch {}
  }
  const manifest = { version: v, bundle: `update/${zip}`, minNative: nativeVersion(), apk: 'Xalca.apk', notes };
  writeFileSync('build/pages/update/version.json', JSON.stringify(manifest, null, 2));
  console.log('\nГотово:', manifest);
} else {
  console.error('Использование: node scripts/build.mjs pages|native');
  process.exit(1);
}
