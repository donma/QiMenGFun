/** 相機與拍照流程檢查：假相機 → 實景 → 拍照 → IndexedDB 紀錄與 JPEG。 */
import { launchBrowser, CACHE_DIR } from './lib/test-browser.mjs';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const URL_BASE = process.env.APP_URL ?? 'http://127.0.0.1:5173/QiMenGFun/';
const OUT = join(CACHE_DIR, 'shots');
mkdirSync(OUT, { recursive: true });

const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['camera', 'accelerometer', 'gyroscope'] });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.addInitScript(() => {
  localStorage.setItem('qimengfun.v1', JSON.stringify({
    schemaVersion: 1, persons: [],
    settings: { onboarded: true, basis: 'civil', timezone: 'Asia/Taipei', lightTheme: 'focus', layerPreset: 'professional', eventKind: 'general' },
  }));
});
await page.goto(URL_BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('.rail.left .rail-btn');

// 進入實景頁應自動啟動相機（無需額外點擊）
await page.waitForTimeout(1400);
const autoVideo = await page.evaluate(() => !!document.querySelector('.scene-media video'));
if (!autoVideo) await page.locator('.rail.left .rail-btn').first().click();
await page.waitForTimeout(800);
const videoState = await page.evaluate(() => {
  const v = document.querySelector('.scene-media video');
  return { hasVideo: !!v, w: v?.videoWidth ?? 0, h: v?.videoHeight ?? 0, readyState: v?.readyState ?? -1 };
});

await page.getByRole('button', { name: '拍照' }).click();
await page.waitForSelector('.toast', { timeout: 15000 });
const toast = await page.locator('.toast').textContent();
const stored = await page.evaluate(async () => {
  const req = indexedDB.open('qimengfun-v1');
  const db = await new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
  const read = (store) => new Promise((resolve, reject) => {
    const r = db.transaction(store, 'readonly').objectStore(store).getAll();
    r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error);
  });
  const records = await read('records');
  const photos = await read('photos');
  const first = photos[0];
  let magic = null;
  if (first?.blob) {
    const bytes = new Uint8Array(await first.blob.arrayBuffer());
    magic = [bytes[0], bytes[1], bytes[2]].join(',');
  }
  return { records: records.length, photos: photos.length, magic, basis: records[0]?.basis ?? null, keStatus: records[0]?.keStatus ?? null };
});
await page.screenshot({ path: join(OUT, 'camera-capture.png') });
await browser.close();
console.log(JSON.stringify({ autoVideo, videoState, toast, stored, errors }, null, 2));
if (errors.length || !autoVideo || stored.records < 1 || stored.magic !== '255,216,255') process.exitCode = 1;
