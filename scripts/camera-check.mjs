/** 相機與拍照：驗證即時影像「真的看得到」（取樣畫面像素），再驗證拍照存檔。 */
import { launchBrowser, CACHE_DIR } from './lib/test-browser.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
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
    settings: { onboarded: true, basis: 'civil', timezone: 'Asia/Taipei', eventKind: 'general' },
  }));
});
await page.goto(URL_BASE, { waitUntil: 'networkidle' });
await page.waitForSelector('.compass-wrap');

// 進入羅盤頁應自動啟動相機，不需任何點擊
await page.waitForFunction(() => { const v = document.querySelector('.scene-media video'); return v && v.videoWidth > 0 && v.readyState >= 2; }, null, { timeout: 15000 });
await page.waitForTimeout(600);

const layers = await page.evaluate(() => {
  const v = document.querySelector('.scene-media video');
  const r = v.getBoundingClientRect();
  return {
    videoW: v.videoWidth, videoH: v.videoHeight,
    coversViewport: r.width >= innerWidth - 1 && r.height >= innerHeight - 1,
    fallbackPresent: !!document.querySelector('.scene-fallback'),
    maskBg: getComputedStyle(document.querySelector('.scene-mask')).backgroundColor,
  };
});

// 取樣真實畫面：盤面外的左側邊緣區域應該是相機畫面（明亮的室內場景），而不是深藍底色
const shot = await page.screenshot({ clip: { x: 0, y: 330, width: 6, height: 200 } });
const probe = await context.newPage();
const avg = await probe.evaluate(async (b64) => {
  const img = new Image();
  await new Promise((res) => { img.onload = res; img.src = 'data:image/png;base64,' + b64; });
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
  const d = ctx.getImageData(0, 0, c.width, c.height).data;
  let r = 0, g = 0, b = 0; const n = d.length / 4;
  for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i + 1]; b += d[i + 2]; }
  return { r: Math.round(r / n), g: Math.round(g / n), b: Math.round(b / n) };
}, shot.toString('base64'));
await probe.close();
const brightness = (avg.r + avg.g + avg.b) / 3;
const cameraVisible = brightness > 70; // 深藍底 #041323 平均約 18

// 以朝向東（90°）拍照，驗證旋轉後的盤面與文字樣式都被完整帶入照片
await page.evaluate(async () => {
  for (let i = 0; i < 30; i += 1) {
    window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', { alpha: 270 + (i % 2) * 0.1, beta: 90, gamma: 0, absolute: true }));
    await new Promise((r) => setTimeout(r, 15));
  }
});
await page.waitForTimeout(500);
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
  if (first?.blob) { const bytes = new Uint8Array(await first.blob.arrayBuffer()); magic = [bytes[0], bytes[1], bytes[2]].join(','); }
  return { records: records.length, photos: photos.length, magic, keStatus: records[0]?.keStatus ?? null, headingDisplay: records[0]?.headingDisplay ?? null };
});
const photoB64 = await page.evaluate(async () => {
  const req = indexedDB.open('qimengfun-v1');
  const db = await new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
  const photos = await new Promise((resolve, reject) => { const r = db.transaction('photos', 'readonly').objectStore('photos').getAll(); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  const buf = new Uint8Array(await photos[0].blob.arrayBuffer());
  let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return btoa(s);
});
writeFileSync(join(OUT, 'captured-photo.jpg'), Buffer.from(photoB64, 'base64'));
await page.screenshot({ path: join(OUT, 'camera-live.png') });
await browser.close();
const result = { layers, avgRGB: avg, brightness: Math.round(brightness), cameraVisible, toast, stored, errors };
console.log(JSON.stringify(result, null, 2));
if (errors.length || !cameraVisible || layers.fallbackPresent || !layers.coversViewport || stored.records < 1 || stored.magic !== '255,216,255') process.exitCode = 1;
