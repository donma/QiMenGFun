/**
 * 基礎象意訊號。分析引擎與排盤分離；這裡只把一個宮位拆成「凶象」與「助力」兩類，
 * 是否算吉由事件取用神（eventProfiles.ts）決定。
 *
 * 進階格局（門迫、擊刑、入墓、伏吟、反吟、旺衰、干加臨）未經例盤驗證，
 * 明確列為 unsupported，不參與判斷。
 */
import type { Chart, Palace } from '../qimen/types';

export const RULE_VERSION = '2.0.0';

/** 凶象：宜慎的八門／九星／八神，以及旬空。 */
export const BAD_DOORS = ['死門', '驚門'] as const;
export const BAD_STARS = ['天蓬', '天芮', '天柱'] as const;
export const BAD_DEITIES = ['白虎', '玄武', '螣蛇'] as const;
/** 助力：吉神。只作輔助說明，不單獨決定吉凶。 */
export const GOOD_DEITIES = ['值符', '九天', '九地', '太陰', '六合'] as const;

export const UNSUPPORTED_RULES = [
  { id: 'pattern.menpo', reason: '門迫需與宮五行及時干旺衰合參，尚無可核對例盤。' },
  { id: 'pattern.jixing', reason: '擊刑之干支組合尚未逐條驗證。' },
  { id: 'pattern.rumu', reason: '入墓的十二長生起點流派未定。' },
  { id: 'pattern.fuyin', reason: '伏吟／反吟需完整天地盤比對，尚未驗證。' },
  { id: 'pattern.wangshuai', reason: '旺衰需季節與宮氣量化，尚未驗證。' },
  { id: 'pattern.ganlin', reason: '干加臨格局需逐條來源核對。' },
] as const;

export interface PalaceSignals {
  /** 凶象（有任何一項就不會是「宜」） */
  cautions: string[];
  /** 助力（只作說明） */
  supports: string[];
}

export function palaceSignals(_chart: Chart, palace: Palace): PalaceSignals {
  const cautions: string[] = [];
  const supports: string[] = [];
  if (palace.door && (BAD_DOORS as readonly string[]).includes(palace.door)) cautions.push(`${palace.door}宜慎`);
  for (const s of palace.stars) {
    if ((BAD_STARS as readonly string[]).includes(s)) cautions.push(`${s}宜慎`);
  }
  if (palace.deity) {
    if ((BAD_DEITIES as readonly string[]).includes(palace.deity)) cautions.push(`${palace.deity}宜慎`);
    else if ((GOOD_DEITIES as readonly string[]).includes(palace.deity)) supports.push(`${palace.deity}吉神助力`);
  }
  if (palace.markers.includes('旬空')) cautions.push('落旬空，事多反覆');
  return { cautions, supports };
}
