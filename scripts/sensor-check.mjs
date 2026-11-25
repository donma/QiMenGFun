/** 方向感測瀏覽器檢查：逐一 pose 送出 orientation 事件，驗證讀數與來源語義。 */
import { launchBrowser } from './lib/test-browser.mjs';

const URL_BASE = process.env.APP_URL ?? 'http://127.0.0.1:5173/QiMenGFun/';
// beta=90（裝置直立）才有水平投影；alpha 與鏡頭朝向的對應由 W3C 旋轉幾何決定。
const POSES = [
  { name: '北', alpha: 0, heading: 0 }, { name: '東北', alpha: 315, heading: 45 },
  { name: '東', alpha: 270, heading: 90 }, { name: '東南', alpha: 225, heading: 135 },
  { name: '南', alpha: 180, heading: 180 }, { name: '西南', alpha: 135, heading: 225 },
  { name: '西', alpha: 90, heading: 270 }, { name: '西北', alpha: 45, heading: 315 },
];


const browser = await launchBrowser();
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, permissions: ['accelerometer', 'gyroscope', 'magnetometer'] });
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
await page.waitForSelector('.heading-readout b');

const fire = (alpha) => page.evaluate(async (a) => {
  for (let i = 0; i < 26; i += 1) {
    window.dispatchEvent(new DeviceOrientationEvent('deviceorientation', {
      alpha: a + (i % 2) * 0.1, beta: 90, gamma: 0, absolute: true,
    }));
    await new Promise((r) => setTimeout(r, 12));
  }
}, alpha);

const results = [];
for (const pose of POSES) {
  await fire(pose.alpha);
  await page.waitForFunction((target) => {
    const v = parseFloat(document.querySelector('.heading-readout b')?.textContent ?? 'NaN');
    if (!Number.isFinite(v)) return false;
    const d = Math.abs(v - target);
    return Math.min(d, 360 - d) <= 8;
  }, pose.heading, { timeout: 4000 }).catch(() => {});
  await page.waitForTimeout(150);
  const reading = await page.evaluate(() => {
    // 文字是否正立：量測螢幕座標下 .t-door 的實際旋轉角（應為 0°，不受盤面旋轉影響）
    const t = document.querySelector('.dial .t-door');
    const m = t?.getScreenCTM();
    const angle = m ? Math.round(((Math.atan2(m.b, m.a) * 180) / Math.PI) * 10) / 10 : null;
    return {
      heading: document.querySelector('.heading-readout b')?.textContent?.trim() ?? null,
      badge: document.querySelector('.heading-readout small')?.textContent?.trim() ?? null,
      textAngle: angle,
    };
  });
  const got = parseFloat(reading.heading ?? 'NaN');
  const err = Number.isFinite(got) ? Math.min(Math.abs(got - pose.heading), 360 - Math.abs(got - pose.heading)) : 999;
  const upright = reading.textAngle !== null && Math.min(Math.abs(reading.textAngle), Math.abs(Math.abs(reading.textAngle) - 360)) <= 3;
  results.push({ pose: pose.name, expected: pose.heading, ...reading, errorDeg: Math.round(err * 10) / 10, upright, pass: err <= 8 && upright });
}
await browser.close();
console.log(JSON.stringify({ results, errors }, null, 2));
if (errors.length || results.some((r) => !r.pass)) process.exitCode = 1;
