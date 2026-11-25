/** SW 基本要求檢查：dist/sw.js 含自行接管邏輯，manifest scope 獨立， precache 含 app shell 與字型。 */
import { readFileSync, existsSync } from 'node:fs';

const dist = 'dist';
const required = ['sw.js', 'manifest.webmanifest', 'index.html'];
const missing = required.filter((f) => !existsSync(`${dist}/${f}`));
const sw = missing.includes('sw.js') ? '' : readFileSync(`${dist}/sw.js`, 'utf8');
const manifest = missing.includes('manifest.webmanifest') ? {} : JSON.parse(readFileSync(`${dist}/manifest.webmanifest`, 'utf8'));
const checks = {
  filesExist: missing.length === 0,
  skipWaiting: /skipWaiting/.test(sw),
  clientsClaim: /clientsClaim/.test(sw),
  scopeIndependent: manifest.scope === '/QiMenGFun/' && manifest.start_url === '/QiMenGFun/',
  themeColor: manifest.theme_color === '#041323',
  offlineShell: /index\.html/.test(sw),
  fontPrecache: /woff2/.test(sw),
};
console.log(JSON.stringify(checks, null, 2));
if (Object.values(checks).some((v) => !v)) process.exitCode = 1;
