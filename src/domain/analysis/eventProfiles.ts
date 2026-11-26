/**
 * 事件取用神與方位判定（產品規則 v2，傳統象意的簡化整理，不是預測）。
 *
 *   取用神：該事件要找的門／星／標記（例如求財取生門、天任）。
 *   凶象：死門、驚門、天蓬、天芮、天柱、白虎、玄武、螣蛇、旬空。
 *
 *   有取用神、無凶象  → favorable（宜，綠）
 *   有取用神、有凶象  → mixed    （吉凶並見，黃）
 *   無取用神、有凶象  → caution  （宜慎，紅）
 *   兩者皆無          → neutral  （平）
 *
 * 切換事件，取用神就不同，結果因此不同。取用神的對照表是具名的產品約定，
 * 尚待古籍逐條核對（見 ai-guide/analysis-rulebook-v1.md）。
 */
import type { Chart, Favorability, Palace } from '../qimen/types';
import { palaceSignals, RULE_VERSION } from './rules';

export type EventKind = 'general' | 'wealth' | 'negotiation' | 'travel' | 'visit' | 'study' | 'rest';

export interface EventProfile {
  id: EventKind;
  label: string;
  sourceId: string;
  favoredDoors: string[];
  favoredStars: string[];
  favoredMarkers: string[];
  note: string;
}

export const EVENT_PROFILES: readonly EventProfile[] = [
  { id: 'general', label: '一般', sourceId: 'yongshen-general-v2', favoredDoors: ['開門', '生門', '休門'], favoredStars: ['天心', '天任', '天輔'], favoredMarkers: [], note: '一般事務：以吉門（開、生、休）與吉星（心、任、輔）為取用神。' },
  { id: 'wealth', label: '求財／經營', sourceId: 'yongshen-wealth-v2', favoredDoors: ['生門', '開門'], favoredStars: ['天任', '天禽'], favoredMarkers: [], note: '求財經營：取生門、開門與天任、天禽；不作收益保證。' },
  { id: 'negotiation', label: '談判／合作', sourceId: 'yongshen-negotiation-v2', favoredDoors: ['開門', '休門'], favoredStars: ['天輔', '天心'], favoredMarkers: [], note: '談判合作：取開門、休門與天輔、天心，取和合之象。' },
  { id: 'travel', label: '出行', sourceId: 'yongshen-travel-v2', favoredDoors: ['生門', '開門'], favoredStars: ['天任', '天英'], favoredMarkers: ['驛馬'], note: '出行：取生門、開門、天任、天英與驛馬方位；不推測路線。' },
  { id: 'visit', label: '拜訪', sourceId: 'yongshen-visit-v2', favoredDoors: ['休門', '開門'], favoredStars: ['天輔', '天心'], favoredMarkers: [], note: '拜訪：取休門、開門與天輔、天心，取相見之象。' },
  { id: 'study', label: '學習考試', sourceId: 'yongshen-study-v2', favoredDoors: ['開門', '杜門'], favoredStars: ['天輔', '天心'], favoredMarkers: [], note: '學習考試：天輔為文星，杜門利靜修；不作成績預測。' },
  { id: 'rest', label: '休息', sourceId: 'yongshen-rest-v2', favoredDoors: ['休門'], favoredStars: ['天心', '天芮'], favoredMarkers: [], note: '休息：取休門與天心、天芮，取安息之象。' },
];

export interface DirectionAssessment {
  palaceId: number;
  favorability: Favorability;
  reasons: string[];
  ruleIds: string[];
  /** 此宮是否出現該事件的取用神 */
  yongshen: boolean;
}

export interface AnalysisResult {
  event: EventKind;
  profileVersion: string;
  sourceId: string;
  note: string;
  directions: DirectionAssessment[];
}

export function yongshenOf(palace: Palace, profile: EventProfile): string[] {
  const out: string[] = [];
  if (palace.door && profile.favoredDoors.includes(palace.door)) out.push(palace.door);
  for (const s of palace.stars) if (profile.favoredStars.includes(s)) out.push(s);
  for (const m of palace.markers) if (profile.favoredMarkers.includes(m)) out.push(m);
  return out;
}

export function analyzeChart(chart: Chart, event: EventKind): AnalysisResult {
  const profile = EVENT_PROFILES.find((p) => p.id === event) ?? EVENT_PROFILES[0]!;
  const directions = chart.palaces
    .filter((p) => p.id !== 5)
    .map((p): DirectionAssessment => {
      if (chart.kind === 'ke') {
        return { palaceId: p.id, favorability: 'unknown', reasons: ['刻家規則尚待驗證，不提供吉凶判斷'], ruleIds: ['chart.unverified'], yongshen: false };
      }
      const yong = yongshenOf(p, profile);
      const { cautions, supports } = palaceSignals(chart, p);
      let favorability: Favorability;
      const reasons: string[] = [];
      const ruleIds: string[] = [];
      if (yong.length) { reasons.push(`${profile.label}取用神：${yong.join('、')}`); ruleIds.push('event.yongshen'); }
      if (cautions.length) { reasons.push(`凶象：${cautions.join('、')}`); ruleIds.push('image.caution'); }
      if (yong.length && !cautions.length) favorability = 'favorable';
      else if (yong.length && cautions.length) favorability = 'mixed';
      else if (cautions.length) favorability = 'caution';
      else { favorability = 'neutral'; reasons.push('沒有明顯的吉凶象意'); }
      if (supports.length) { reasons.push(...supports); ruleIds.push('image.deity'); }
      return { palaceId: p.id, favorability, reasons, ruleIds, yongshen: yong.length > 0 };
    });
  return { event, profileVersion: RULE_VERSION, sourceId: profile.sourceId, note: profile.note, directions };
}

export function palaceLabel(palace: Palace): string {
  return `${palace.id}宮`;
}
