/** 真瀏覽器 RWD 檢查：多種尺寸截圖 + 觸控區／溢出／console 錯誤檢查。 */
import { launchBrowser, CACHE_DIR } from './lib/test-browser.mjs';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const URL_BASE = process.env.APP_URL ?? 'http://127.0.0.1:5173/QiMenGFun/';
const OUT = join(CACHE_DIR, 'shots');
mkdirSync(OUT, { recursive: true });

const SCENARIOS = [
  { id: 'iphone-se', w: 375, h: 667 },
  { id: 'iphone-14', w: 390, h: 844 },
  { id: 'small-android', w: 360, h: 640 },
  { id: 'landscape', w: 844, h: 390 },
  { id: 'ipad', w: 820, h: 1180 },
  { id: 'desktop', w: 1280, h: 800 },
];

const browser = await launchBrowser();
const results = [];
for (const s of SCENARIOS) {
  const context = await browser.newContext({
    viewport: { width: s.w, height: s.h },
    deviceScaleFactor: 2,
    permissions: ['camera'],
  });
  await context.addInitScript(() => {
    localStorage.setItem('qimengfun.v1', JSON.stringify({
      schemaVersion: 1, persons: [],
      settings: { onboarded: true, basis: 'civil', timezone: 'Asia/Taipei', lightTheme: 'focus', layerPreset: 'professional', eventKind: 'general' },
    }));
  });
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(URL_BASE, { waitUntil: 'networkidle' });
  await page.waitForSelector('.dial', { timeout: 10000 });
  await page.waitForTimeout(300);
  const metrics = await page.evaluate(() => {
    const rect = (sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, w: r.width, h: r.height, bottom: r.bottom, right: r.right };
    };
    const small = [...document.querySelectorAll('button')]
      .map((b) => ({ label: b.textContent?.trim().slice(0, 12) ?? '', r: b.getBoundingClientRect() }))
      .filter((x) => x.r.width > 0 && (x.r.width < 44 || x.r.height < 32))
      .slice(0, 8).map((x) => ({ label: x.label, w: Math.round(x.r.width), h: Math.round(x.r.height) }));
    const overflow = [...document.querySelectorAll('*')]
      .filter((el) => !(el instanceof SVGElement) && el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflowX === 'visible')
      .slice(0, 6).map((el) => `${el.tagName}.${el.className?.toString?.().slice(0, 40) ?? ''} (${el.scrollWidth}>${el.clientWidth})`);
    return {
      vw: innerWidth, vh: innerHeight,
      dial: rect('.compass-wrap'), timebar: rect('.timebar'), tabbar: rect('.tabbar'),
      topInfo: rect('.top-info'), rails: rect('.rail.left'),
      scrollW: document.documentElement.scrollWidth,
      scrollH: document.documentElement.scrollHeight,
      small, overflow,
      overlaps: (() => {
        const rs = { dial: '.compass-wrap', card: '.focus-card', tabbar: '.tabbar', info: '.top-info' };
        const R = Object.fromEntries(Object.entries(rs).map(([k, s]) => [k, document.querySelector(s)?.getBoundingClientRect() ?? null]));
        const hit = (a, b) => a && b && a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1;
        return [['dial', 'card'], ['dial', 'tabbar'], ['dial', 'info'], ['card', 'tabbar'], ['card', 'info']].filter(([a, b]) => hit(R[a], R[b])).map((p) => p.join('×'));
      })(),
      ju: document.querySelector('.top-ju')?.textContent?.trim().slice(0, 40) ?? null,
      focus: document.querySelector('.focus-card') ? (() => { const r = document.querySelector('.focus-card').getBoundingClientRect(); return { y: r.y, bottom: r.bottom }; })() : null,
    };
  });
  const dialogCovered = metrics.dial && metrics.dial.x >= -2 && metrics.dial.right <= metrics.vw + 2 && metrics.dial.y >= -2 && metrics.dial.bottom <= metrics.vh + 2;
  await page.screenshot({ path: join(OUT, `${s.id}.png`) });
  // 顏色說明彈窗
  if (s.id === 'iphone-14') {
    await page.locator('.info-btn').click();
    await page.waitForTimeout(250);
    const legend = await page.evaluate(() => document.querySelector('.modal')?.textContent?.includes('綠色') ?? false);
    await page.screenshot({ path: join(OUT, 'iphone-14-legend.png') });
    if (!legend) errors.push('顏色說明彈窗未出現');
    await page.locator('.modal .btn.primary').click();
  }
  // 各分頁截圖（窄螢幕）
  if (s.id === 'iphone-14' || s.id === 'small-android') {
    for (const [tab, label] of [['analysis', '分析'], ['time', '時光'], ['tools', '工具'], ['records', '紀錄']]) {
      const btn = page.locator('.tabbar .tab', { hasText: label });
      if (await btn.count()) {
        await btn.first().click();
        await page.waitForTimeout(250);
        await page.screenshot({ path: join(OUT, `${s.id}-${tab}.png`) });
        await page.locator('.panel-head .icon-btn').click();
        await page.waitForTimeout(150);
      }
    }
  }
  results.push({ ...s, metrics, dialogCovered, errors });
  await context.close();
}
await browser.close();
writeFileSync(join(CACHE_DIR, 'layout-report.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results.map((r) => ({ id: r.id, dial: r.metrics.dial && `${Math.round(r.metrics.dial.w)}px`, covered: r.dialogCovered, overlaps: r.metrics.overlaps, overflow: r.metrics.overflow.length, errors: r.errors.length })), null, 2));
if (results.some((r) => !r.dialogCovered || r.metrics.overlaps.length || r.errors.length)) process.exitCode = 1;
