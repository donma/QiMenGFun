/**
 * 產生內嵌顯示字體：Noto Serif TC Bold（SIL OFL 1.1）→ 只保留介面用得到的字 → woff2。
 *
 * 為什麼要內嵌：Windows 沒有開源明體，`serif` 會落到細明體（MingLiU），
 * 小字級＋偽粗體會有毛邊；iOS／Android 的明體也各不相同。內嵌後三平台一致、可離線。
 *
 * 用法：npm run fonts
 *   - 第一次執行會下載來源字型（約 8 MB）到 scripts/.cache/（已在 .gitignore）
 *   - 輸出 src/assets/fonts/qm-serif-bold.woff2（請連同授權檔一起提交）
 *
 * 字集 = 專案原始碼（去除註解）內「短標題級」（≤16 字）的中文片段 + 基本拉丁字元。
 * 新增介面標題後重新執行本腳本即可。長句說明與使用者輸入的人名使用系統無襯線體，不依賴此子集。
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import subsetFont from "subset-font";

const ROOT = process.cwd();
const CACHE = join(ROOT, "scripts", ".cache");
const OUT_DIR = join(ROOT, "src", "assets", "fonts");
const SRC_URL = "https://raw.githubusercontent.com/notofonts/noto-cjk/main/Serif/SubsetOTF/TC/NotoSerifTC-Bold.otf";
const LICENSE_URL = "https://raw.githubusercontent.com/notofonts/noto-cjk/main/Serif/LICENSE";
const SRC_FILE = join(CACHE, "NotoSerifTC-Bold.otf");
const LICENSE_FILE = join(CACHE, "OFL.txt");

async function download(url, file) {
  console.log("下載", url);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`下載失敗 ${res.status} ${url}`);
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === "node_modules" || name === "assets") continue;
      walk(p, out);
    } else if ([".ts", ".tsx", ".css"].includes(extname(p)) && !/\.test\.ts$/.test(p)) {
      out.push(p);
    }
  }
  return out;
}

function stripComments(code) {
  return code
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

// 中日韓統一表意文字、標點、全形符號
const CJK_CHAR = "\\u3000-\\u303f\\u4e00-\\u9fff\\uff00-\\uffef";
// 連續的中文片段（可夾數字／英文／空白）。長句（說明、免責聲明）使用系統無襯線體，不需內嵌。
const RUN = new RegExp(`[${CJK_CHAR}][${CJK_CHAR}0-9A-Za-z°·\\s]*`, "g");
const MAX_RUN = 16;

mkdirSync(CACHE, { recursive: true });
mkdirSync(OUT_DIR, { recursive: true });
if (!existsSync(SRC_FILE)) await download(SRC_URL, SRC_FILE);
if (!existsSync(LICENSE_FILE)) await download(LICENSE_URL, LICENSE_FILE);

const chars = new Set();
for (let c = 0x20; c <= 0x7e; c++) chars.add(String.fromCharCode(c)); // 基本拉丁、數字
for (const ch of "°·•—–…‧・「」『』【】《》〈〉（）：；，。、！？％＋－×÷≈≤≥→←↑↓›‹▲▼") chars.add(ch);
const files = walk(join(ROOT, "src"));
for (const f of files) {
  const code = stripComments(readFileSync(f, "utf8"));
  for (const m of code.matchAll(RUN)) {
    const run = m[0].trim();
    if (run.length <= MAX_RUN) for (const ch of run) chars.add(ch);
  }
}

const text = [...chars].join("");
console.log(`掃描 ${files.length} 個檔案，字集 ${chars.size} 字`);

const source = readFileSync(SRC_FILE);
const woff2 = await subsetFont(source, text, { targetFormat: "woff2" });
writeFileSync(join(OUT_DIR, "qm-serif-bold.woff2"), woff2);
writeFileSync(join(OUT_DIR, "OFL.txt"), readFileSync(LICENSE_FILE));
writeFileSync(
  join(OUT_DIR, "README.md"),
  `# 內嵌字體

- \`qm-serif-bold.woff2\`：Noto Serif TC Bold 的子集（${chars.size} 字），來源 https://github.com/notofonts/noto-cjk
- 授權：SIL Open Font License 1.1（見 \`OFL.txt\`）。允許內嵌與再散布；不得單獨販售字型本身。
- 重新產生：\`npm run fonts\`（掃描 src/ 內的介面文字）。
`,
);
console.log(`輸出 qm-serif-bold.woff2：${(woff2.length / 1024).toFixed(1)} KB`);
