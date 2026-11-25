/**
 * 年命（選用）：只做年干映射，不計算完整八字、不判喜用神。
 * 立春附近缺出生時間時不猜年干；切換人物不影響基礎盤 hash。
 */
import { ganzhiAt } from '../qimen/tables';
import { lichunInstantMs } from '../calendar/solarTerms';
import { XUN_HIDDEN_STEMS } from '../qimen/tables';
import type { Chart } from '../qimen/types';

export interface BirthInfo {
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:mm or null
  timezone: string;
}

export interface YearLifeResult {
  status: 'ok' | 'uncertain' | 'unavailable';
  yearGanzhi: string | null;
  reason: string;
  candidates: Array<{ palaceId: number; layer: string; reason: string }>;
}

export const YEAR_LIFE_VERSION = '1.0.0';

export function analyzeYearLife(birth: BirthInfo, chart: Chart | null): YearLifeResult {
  if (!birth.date || !chart) {
    return { status: 'unavailable', yearGanzhi: null, reason: '生日未知，不顯示年命結果。', candidates: [] };
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth.date);
  if (!m) return { status: 'unavailable', yearGanzhi: null, reason: '生日格式無效。', candidates: [] };
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const lichun = lichunInstantMs(year);
  const nearLichun = Math.abs(Date.UTC(year, month - 1, day) - lichun) <= 2 * 86_400_000;
  if (nearLichun && !birth.time) {
    return { status: 'uncertain', yearGanzhi: null, reason: '出生接近立春且缺出生時間，不猜年干。', candidates: [] };
  }
  const noonUTC = Date.UTC(year, month - 1, day, 12);
  const ganzhiYear = noonUTC >= lichun ? year : year - 1;
  const yearIndex = (((ganzhiYear - 4) % 60) + 60) % 60;
  const yearGanzhi = ganzhiAt(yearIndex);
  const stem = yearGanzhi.slice(0, 1);
  const branch = yearGanzhi.slice(1);
  const effectiveStem = stem === '甲'
    ? XUN_HIDDEN_STEMS[Math.floor(yearIndex / 10)] ?? '戊'
    : stem;

  const candidates = chart.palaces.flatMap((p) => {
    const out: Array<{ palaceId: number; layer: string; reason: string }> = [];
    if (p.heavenStems.includes(effectiveStem)) {
      out.push({ palaceId: p.id, layer: '天盤', reason: `年干${stem}（${stem === '甲' ? `遁${effectiveStem}` : '直接使用'}）落天盤` });
    }
    if (p.earthStems.includes(effectiveStem)) {
      out.push({ palaceId: p.id, layer: '地盤', reason: `年干${stem}（${stem === '甲' ? `遁${effectiveStem}` : '直接使用'}）本地盤` });
    }
    return out;
  });
  return {
    status: candidates.length ? 'ok' : 'unavailable',
    yearGanzhi,
    reason: candidates.length ? `年命${yearGanzhi}（${branch}），列出所有候選宮位。` : '此盤未找到年干落宮。',
    candidates,
  };
}
