/**
 * 真瀏覽器實測腳本（layout／sensor／camera）共用：找瀏覽器、提供穩定的假相機、統一啟動參數。
 *
 * 為什麼不用瀏覽器內建的假相機？
 *   Chromium 內建的假相機（綠色測試圖）會在啟動後數秒自行結束串流，之後畫面全黑
 *   （Edge 155 與 Chrome 156、有頭／無頭皆如此；與 App 無關，單獨一個只有 getUserMedia 的空白頁也一樣）。
 *   所以改用 --use-file-for-fake-video-capture 餵一段循環播放的 Y4M 畫面：串流不會自己結束，
 *   而且是一個「有亮有暗的室內場景」，可以肉眼判斷半透明羅盤疊在實景上的樣子。
 *
 * 這只是測試素材：產生在 scripts/.cache（已被 .gitignore 排除），不進 App、不進 dist。
 */
import { chromium } from "playwright-core";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const CACHE_DIR = path.resolve(here, "..", ".cache");

const BROWSER_CANDIDATES = [
  process.env.BROWSER_PATH,
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
].filter(Boolean);

/** 找到本機 Chrome／Edge；找不到就印出說明並結束 */
export function requireBrowser() {
  const exe = BROWSER_CANDIDATES.find((p) => existsSync(p));
  if (!exe) {
    console.error("找不到 Chrome／Edge，請設定環境變數 BROWSER_PATH 指向瀏覽器執行檔");
    process.exit(2);
  }
  return exe;
}

/* ---------- 假相機畫面（Y4M） ---------- */

const FRAME_W = 960;
const FRAME_H = 540;
const FRAMES = 10;
/** 改了畫面內容就把版本加一，會重新產生檔案 */
const SCENE_VERSION = 1;

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

/** 室內場景：米色牆、窗（亮）、深色木門、木地板；一條緩慢移動的光帶表示畫面是「活的」 */
function sceneRGB(x, y, f) {
  const u = x / FRAME_W;
  const v = y / FRAME_H;
  let r = 224 - 40 * u - 16 * v;
  let g = 206 - 36 * u - 16 * v;
  let b = 178 - 32 * u - 16 * v;

  // 左側掛畫
  if (u > 0.09 && u < 0.23 && v > 0.2 && v < 0.46) {
    const edge = u < 0.1 || u > 0.22 || v < 0.21 || v > 0.45;
    [r, g, b] = edge ? [96, 70, 44] : [86 + 60 * v, 120 + 40 * u, 140 + 30 * v];
  }
  // 中央偏上的窗戶（直式裁切時也會出現在羅盤後方，用來檢視亮背景下的文字可讀性）
  if (u > 0.4 && u < 0.6 && v > 0.07 && v < 0.47) {
    const frame = u < 0.412 || u > 0.588 || v < 0.085 || v > 0.455 || Math.abs(u - 0.5) < 0.006 || Math.abs(v - 0.27) < 0.008;
    [r, g, b] = frame ? [244, 240, 232] : [206 + 36 * (1 - v), 226 + 22 * (1 - v), 246];
  }
  // 右側深色木門
  if (u > 0.73 && u < 0.9 && v > 0.07 && v < 0.74) {
    const grain = 10 * Math.sin(u * 160 + v * 9);
    [r, g, b] = [104 + grain, 72 + grain * 0.7, 46 + grain * 0.5];
  }
  // 踢腳板與木地板
  if (v > 0.74 && v <= 0.76) [r, g, b] = [240, 232, 216];
  if (v > 0.76) {
    const t = (v - 0.76) / 0.24;
    const plank = Math.floor((u + t * 0.35) * 11) % 2 === 0 ? 8 : 0;
    [r, g, b] = [150 - 44 * t + plank, 104 - 32 * t + plank * 0.8, 64 - 20 * t + plank * 0.6];
  }
  // 矮桌
  if (u > 0.3 && u < 0.7 && v > 0.64 && v < 0.77) [r, g, b] = [88, 62, 40];

  // 移動光帶
  const band = Math.exp(-Math.pow((u - f / FRAMES) * 9, 2)) * 22;
  return [clamp(r + band), clamp(g + band), clamp(b + band)];
}

function makeY4m(file) {
  const parts = [Buffer.from(`YUV4MPEG2 W${FRAME_W} H${FRAME_H} F10:1 Ip A1:1 C420jpeg\n`)];
  const cw = FRAME_W / 2;
  const ch = FRAME_H / 2;
  for (let f = 0; f < FRAMES; f++) {
    const Y = Buffer.alloc(FRAME_W * FRAME_H);
    const U = Buffer.alloc(cw * ch);
    const V = Buffer.alloc(cw * ch);
    for (let y = 0; y < FRAME_H; y++) {
      for (let x = 0; x < FRAME_W; x++) {
        const [r, g, b] = sceneRGB(x, y, f);
        Y[y * FRAME_W + x] = clamp(0.299 * r + 0.587 * g + 0.114 * b);
        if ((x & 1) === 0 && (y & 1) === 0) {
          const i = (y >> 1) * cw + (x >> 1);
          U[i] = clamp(128 - 0.168736 * r - 0.331264 * g + 0.5 * b);
          V[i] = clamp(128 + 0.5 * r - 0.418688 * g - 0.081312 * b);
        }
      }
    }
    parts.push(Buffer.from("FRAME\n"), Y, U, V);
  }
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, Buffer.concat(parts));
}

/** 回傳假相機 Y4M 檔的路徑（不存在就產生） */
export function fakeCameraFile() {
  const file = path.join(CACHE_DIR, `fake-camera-v${SCENE_VERSION}.y4m`);
  if (!existsSync(file)) makeY4m(file);
  return file;
}

/**
 * 瀏覽器啟動參數。
 * @param {{ builtinFakeCamera?: boolean, extra?: string[] }} opts
 *   builtinFakeCamera=true 時使用瀏覽器內建的假相機（會自行結束），僅供想重現「相機被中斷」時使用。
 */
export function browserArgs(opts = {}) {
  const args = ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", "--autoplay-policy=no-user-gesture-required"];
  if (!opts.builtinFakeCamera) args.push(`--use-file-for-fake-video-capture=${fakeCameraFile()}`);
  return [...args, ...(opts.extra ?? [])];
}

export async function launchBrowser(opts = {}) {
  return chromium.launch({ executablePath: requireBrowser(), headless: true, args: browserArgs(opts) });
}

/** 常用的測試人物：1991-06-15 女 → 乾六命（西四命、金），西北＝伏位 */
export const TEST_STORAGE = {
  schemaVersion: 1,
  persons: [{ id: "p1", name: "張明遠", birthDate: "1991-06-15", birthTime: null, sex: "female", kua: 6, createdAt: "2026-01-01T00:00:00.000Z" }],
  settings: { northReference: "magnetic", manualOffsetDeg: 0, currentPersonId: "p1" },
};
