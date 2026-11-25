/**
 * 24 節氣的精確 UTC 交節時刻。
 *
 * 資料來源：tyme4ts 1.5.6（MIT，6tail/Tyme，寿星天文历算法）。
 * 鎖版驗證錨點：小寒 2026 = 2026-01-05T08:23:10Z（台灣 16:23:10），
 * 與白話命理〈奇門拆補法〉2026-11-19 所載完全一致。
 * 天文交節瞬間不受真太陽時修正影響。
 */
import { SolarTerm } from 'tyme4ts';
import { TERMS, JIE_TERMS } from '../qimen/tables';
import type { TermBoundary } from '../qimen/types';

const TYME_NAMES: Record<string, string> = {
  驚蟄: '惊蛰', 穀雨: '谷雨', 小滿: '小满', 芒種: '芒种', 處暑: '处暑',
};

/** 交節時刻的保守不確定窗；進入此窗時 UI 提示交界不確定。 */
export const TERM_UNCERTAINTY_MS = 60_000;

const cache = new Map<number, TermBoundary[]>();

export function termBoundariesForYear(year: number): TermBoundary[] {
  const cached = cache.get(year);
  if (cached) return cached;
  const list: TermBoundary[] = [];
  for (const y of [year - 1, year, year + 1]) {
    for (const name of TERMS) {
      const term = SolarTerm.fromName(y, TYME_NAMES[name] ?? name);
      const jd = term.getJulianDay().getDay();
      // Tyme 的 SolarTerm.getJulianDay() 以北京時間鐘面作為 JDN；
      // 換算成真正 UTC instant 需減 8 小時（固定，不受 DST 影響）。
      list.push({ name, instantMs: Math.round((jd - 2440587.5) * 86_400_000 - 8 * 3_600_000) });
    }
  }
  list.sort((a, b) => a.instantMs - b.instantMs);
  cache.set(year, list);
  return list;
}

export interface TermAt {
  name: string;
  fromMs: number;
  untilMs: number;
  nearBoundary: boolean;
}

export function termAt(instantMs: number): TermAt {
  const year = new Date(instantMs).getUTCFullYear();
  const list = termBoundariesForYear(year);
  let idx = -1;
  for (let i = 0; i < list.length; i += 1) {
    if (list[i]!.instantMs <= instantMs) idx = i;
    else break;
  }
  if (idx < 0) idx = 0;
  const cur = list[idx]!;
  const next = list[idx + 1] ?? { instantMs: cur.instantMs + 16 * 86_400_000, name: cur.name };
  return {
    name: cur.name,
    fromMs: cur.instantMs,
    untilMs: next.instantMs,
    nearBoundary: Math.min(Math.abs(instantMs - cur.instantMs), Math.abs(instantMs - next.instantMs)) <= TERM_UNCERTAINTY_MS,
  };
}

/** 最近通過的十二「節」（非中氣），供換月使用。 */
export function jieAt(instantMs: number): string {
  const year = new Date(instantMs).getUTCFullYear();
  const list = termBoundariesForYear(year);
  let name = '立春';
  for (const b of list) {
    if (b.instantMs > instantMs) break;
    if (JIE_TERMS.includes(b.name)) name = b.name;
  }
  return name;
}

export function lichunInstantMs(year: number): number {
  const hit = termBoundariesForYear(year).find((b) => b.name === '立春' && new Date(b.instantMs).getUTCFullYear() === year);
  return hit?.instantMs ?? Date.UTC(year, 1, 4);
}

/** 指定 UTC 年中的所有交節／換季事件（供計時調度）。 */
export function ruleEventsInRange(startMs: number, endMs: number): TermBoundary[] {
  const out: TermBoundary[] = [];
  for (let y = new Date(startMs).getUTCFullYear(); y <= new Date(endMs).getUTCFullYear(); y += 1) {
    for (const b of termBoundariesForYear(y)) {
      if (b.instantMs >= startMs && b.instantMs <= endMs) out.push(b);
    }
  }
  return out.sort((a, b) => a.instantMs - b.instantMs);
}
