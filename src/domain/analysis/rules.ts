/**
 * 分析引擎與排盤分離。只啟用具名來源的基礎象意規則；
 * 進階格局（門迫、擊刑、入墓、伏吟、反吟、旺衰、干加臨）未經例盤驗證，
 * 明確列為 unsupported，不參與推薦。
 */
import type { Chart, Favorability, Palace } from '../qimen/types';

export interface RuleResult {
  ruleId: string;
  version: string;
  sourceId: string;
  favorability: Favorability;
  reason: string;
}

export const RULE_VERSION = '1.0.0';

const GOOD_DOORS = ['開門', '生門', '休門'];
const BAD_DOORS = ['死門', '驚門'];
const GOOD_STARS = ['天心', '天任', '天輔', '天禽'];
const BAD_STARS = ['天蓬', '天芮', '天柱'];
const GOOD_DEITIES = ['值符', '九天', '九地', '太陰', '六合'];
const BAD_DEITIES = ['白虎', '玄武', '螣蛇'];

export const UNSUPPORTED_RULES = [
  { id: 'pattern.menpo', reason: '門迫需與宮五行及時干旺衰合參，尚無可核對例盤。' },
  { id: 'pattern.jixing', reason: '擊刑之干支組合尚未逐條驗證。' },
  { id: 'pattern.rumu', reason: '入墓的十二長生起點流派未定。' },
  { id: 'pattern.fuyin', reason: '伏吟／反吟需完整天地盤比對，尚未驗證。' },
  { id: 'pattern.wangshuai', reason: '旺衰需季節與宮氣量化，尚未驗證。' },
  { id: 'pattern.ganlin', reason: '干加臨格局需逐條來源核對。' },
] as const;

const rule = (ruleId: string, sourceId: string, favorability: Favorability, reason: string): RuleResult => ({
  ruleId, version: RULE_VERSION, sourceId, favorability, reason,
});

export function evaluatePalace(chart: Chart, palace: Palace): RuleResult[] {
  const out: RuleResult[] = [];
  if (palace.door) {
    if (GOOD_DOORS.includes(palace.door)) out.push(rule('image.door', 'ba-men-xiang-traditional-v1', 'favorable', `${palace.door}屬吉門象意`));
    else if (BAD_DOORS.includes(palace.door)) out.push(rule('image.door', 'ba-men-xiang-traditional-v1', 'caution', `${palace.door}屬宜慎之門`));
    else out.push(rule('image.door', 'ba-men-xiang-traditional-v1', 'mixed', `${palace.door}象意隨事而異`));
  }
  for (const star of palace.stars) {
    if (GOOD_STARS.includes(star)) out.push(rule('image.star', 'jiu-xing-xiang-traditional-v1', 'favorable', `${star}為吉星象意`));
    else if (BAD_STARS.includes(star)) out.push(rule('image.star', 'jiu-xing-xiang-traditional-v1', 'caution', `${star}象意宜慎`));
    else out.push(rule('image.star', 'jiu-xing-xiang-traditional-v1', 'mixed', `${star}象意隨事而異`));
  }
  if (palace.deity) {
    if (GOOD_DEITIES.includes(palace.deity)) out.push(rule('image.deity', 'ba-shen-xiang-traditional-v1', 'favorable', `${palace.deity}為吉神象意`));
    else if (BAD_DEITIES.includes(palace.deity)) out.push(rule('image.deity', 'ba-shen-xiang-traditional-v1', 'caution', `${palace.deity}象意宜慎`));
  }
  if (palace.markers.includes('旬空')) {
    out.push(rule('marker.kong', 'xunkong-traditional-v1', 'caution', '落旬空，事多反覆'));
  }
  if (palace.markers.includes('驛馬')) {
    out.push(rule('marker.yima', 'yima-traditional-v1', 'mixed', '驛馬利出行變動，餘事不全作吉論'));
  }
  if (chart.kind === 'ke') {
    out.push(rule('chart.unverified', 'ke-rulebook-v1', 'unknown', '刻家規則尚待驗證，不提供吉凶判斷'));
  }
  return out;
}

export function aggregate(results: RuleResult[]): Favorability {
  if (results.some((r) => r.favorability === 'unknown')) return 'unknown';
  const good = results.filter((r) => r.favorability === 'favorable').length;
  const bad = results.filter((r) => r.favorability === 'caution').length;
  const mixed = results.filter((r) => r.favorability === 'mixed').length;
  if (good === 0 && bad === 0 && mixed === 0) return 'unknown';
  if (good > 0 && bad > 0) return 'mixed';
  if (bad > 0 && good === 0) return mixed > 0 ? 'mixed' : 'caution';
  if (good > 0 && bad === 0 && mixed > 0) return 'mixed';
  return 'favorable';
}
