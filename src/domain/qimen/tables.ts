/**
 * Named profile tables for 時家轉盤拆補.
 *
 * Sources (see ai-guide/sources.md):
 *  - 局數歌 / 二至還鄉圖: 《欽定古今圖書集成》藝術典卷 703（電子轉錄）
 *  - 拆補取節與三元: 白話命理〈奇門拆補法〉2026-11-19（本站 UTC+8、子初換日、中五寄坤）
 *  - 宮位/星/門/神: 轉盤奇門通用表，profile hour-zhuan-chaibu-v1
 *
 * 數序 (1..9) 與環序 (RING) 不得混用。
 */
import type { Dun, PalaceDef, PalaceId, Yuan } from './types';

export const STEMS = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸'] as const;
export const BRANCHES = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥'] as const;

/** 地盤布干順序：六儀（遁干）後三奇。 */
export const EARTH_STEM_ORDER = ['戊', '己', '庚', '辛', '壬', '癸', '丁', '丙', '乙'] as const;
/** 旬首六甲所遁之干，依六十甲子旬序。 */
export const XUN_HIDDEN_STEMS = ['戊', '己', '庚', '辛', '壬', '癸'] as const;

/** 顺时针环序，北 0° 起。 */
export const RING: readonly PalaceId[] = [1, 8, 3, 4, 9, 2, 7, 6];

/** 九宫格 traditional 南上北下，仅用于方格视图。 */
export const GRID_SOUTH_UP: readonly (readonly PalaceId[])[] = [
  [4, 9, 2],
  [3, 5, 7],
  [8, 1, 6],
];

export const PALACES: readonly PalaceDef[] = [
  { id: 1, deg: 0, name: '坎', short: '坎一', branches: ['子'], element: '水' },
  { id: 2, deg: 225, name: '坤', short: '坤二', branches: ['未', '申'], element: '土' },
  { id: 3, deg: 90, name: '震', short: '震三', branches: ['卯'], element: '木' },
  { id: 4, deg: 135, name: '巽', short: '巽四', branches: ['辰', '巳'], element: '木' },
  { id: 5, deg: null, name: '中', short: '中五', branches: ['辰', '戌', '丑', '未'], element: '土' },
  { id: 6, deg: 315, name: '乾', short: '乾六', branches: ['戌', '亥'], element: '金' },
  { id: 7, deg: 270, name: '兌', short: '兌七', branches: ['酉'], element: '金' },
  { id: 8, deg: 45, name: '艮', short: '艮八', branches: ['丑', '寅'], element: '土' },
  { id: 9, deg: 180, name: '離', short: '離九', branches: ['午'], element: '火' },
];

export const STARS_BY_PALACE: Record<PalaceId, string> = {
  1: '天蓬',
  2: '天芮',
  3: '天沖',
  4: '天輔',
  5: '天禽',
  6: '天心',
  7: '天柱',
  8: '天任',
  9: '天英',
};

export const DOORS_BY_PALACE: Record<PalaceId, string | null> = {
  1: '休門',
  2: '死門',
  3: '傷門',
  4: '杜門',
  5: null,
  6: '開門',
  7: '驚門',
  8: '生門',
  9: '景門',
};

/**
 * 八神：值符起，陽遁順行、陰遁逆行；神名順序相同。
 * 驗證來源：白話命理排盤工具 2026-07-15 12:00 陰遁五局
 * （坎一值符→乾六螣蛇→兌七太陰→坤二六合→離九白虎→巽四玄武→震三九地→艮八九天）。
 * 其他流派可能有神名差異，本 profile 採此具名來源。
 */
export const DEITIES: Record<Dun, readonly string[]> = {
  yang: ['值符', '螣蛇', '太陰', '六合', '白虎', '玄武', '九地', '九天'],
  yin: ['值符', '螣蛇', '太陰', '六合', '白虎', '玄武', '九地', '九天'],
};

/** 24 節氣，依太陽視黃經順序（冬至為起點）。 */
export const TERMS: readonly string[] = [
  '冬至', '小寒', '大寒', '立春', '雨水', '驚蟄',
  '春分', '清明', '穀雨', '立夏', '小滿', '芒種',
  '夏至', '小暑', '大暑', '立秋', '處暑', '白露',
  '秋分', '寒露', '霜降', '立冬', '小雪', '大雪',
];

/** 十二節（換月用），與 TERMS 中的節而非氣。 */
export const JIE_TERMS: readonly string[] = [
  '立春', '驚蟄', '清明', '立夏', '芒種', '小暑',
  '立秋', '白露', '寒露', '立冬', '大雪', '小寒',
];

/**
 * 局數表：上元 / 中元 / 下元。
 * 冬至 1-7-4 … 大雪 4-7-1；與施工規格 v1.0 §4 逐項一致。
 */
export const JU_TABLE: Record<string, readonly [number, number, number]> = {
  冬至: [1, 7, 4], 小寒: [2, 8, 5], 大寒: [3, 9, 6], 立春: [8, 5, 2],
  雨水: [9, 6, 3], 驚蟄: [1, 7, 4], 春分: [3, 9, 6], 清明: [4, 1, 7],
  穀雨: [5, 2, 8], 立夏: [4, 1, 7], 小滿: [5, 2, 8], 芒種: [6, 3, 9],
  夏至: [9, 3, 6], 小暑: [8, 2, 5], 大暑: [7, 1, 4], 立秋: [2, 5, 8],
  處暑: [1, 4, 7], 白露: [9, 3, 6], 秋分: [7, 1, 4], 寒露: [6, 9, 3],
  霜降: [5, 8, 2], 立冬: [6, 9, 3], 小雪: [5, 8, 2], 大雪: [4, 7, 1],
};

export const YUAN_INDEX: Record<Yuan, number> = { upper: 0, middle: 1, lower: 2 };
export const YUAN_NAME: Record<Yuan, string> = { upper: '上元', middle: '中元', lower: '下元' };

/** 地支 → 宮（相鄰雙支宮視為同一方位）。 */
export const BRANCH_PALACE: Record<string, PalaceId> = {
  子: 1, 丑: 8, 寅: 8, 卯: 3, 辰: 4, 巳: 4,
  午: 9, 未: 2, 申: 2, 酉: 7, 戌: 6, 亥: 6,
};

export function ringIndex(palace: PalaceId): number {
  const hosted: PalaceId = palace === 5 ? 2 : palace;
  const idx = RING.indexOf(hosted);
  return idx < 0 ? 0 : idx;
}

export function palaceAtRing(index: number): PalaceId {
  return RING[((index % 8) + 8) % 8] ?? 1;
}

export function branchIndex(branch: string): number {
  const i = BRANCHES.indexOf(branch as (typeof BRANCHES)[number]);
  return i < 0 ? 0 : i;
}

export function stemIndex(stem: string): number {
  const i = STEMS.indexOf(stem as (typeof STEMS)[number]);
  return i < 0 ? 0 : i;
}

/** 六十甲子 index（甲子 = 0）。 */
export function ganzhiIndex(stem: string, branch: string): number {
  const s = stemIndex(stem);
  const b = branchIndex(branch);
  for (let i = 0; i < 60; i += 1) {
    if (i % 10 === s && i % 12 === b) return i;
  }
  return 0;
}

export function ganzhiAt(index: number): string {
  const i = ((index % 60) + 60) % 60;
  return `${STEMS[i % 10]}${BRANCHES[i % 12]}`;
}

/** 符頭（五日一組的起日，甲或己）→ 三元。 */
export function yuanOfFuTou(fuTou: string): Yuan {
  const branch = fuTou.slice(1);
  if (['子', '午', '卯', '酉'].includes(branch)) return 'upper';
  if (['寅', '申', '巳', '亥'].includes(branch)) return 'middle';
  return 'lower';
}

/** 旬空：旬首地支後兩支。 */
export function emptyBranchesForXun(xunHead: string): string[] {
  const b = branchIndex(xunHead.slice(1));
  return [BRANCHES[(b + 10) % 12] ?? '', BRANCHES[(b + 11) % 12] ?? ''];
}

/** 驛馬：以日支取用，profile 明示。 */
export function yiMaForDay(dayBranch: string): string {
  if (['申', '子', '辰'].includes(dayBranch)) return '寅';
  if (['寅', '午', '戌'].includes(dayBranch)) return '申';
  if (['巳', '酉', '丑'].includes(dayBranch)) return '亥';
  return '巳';
}
