/** 事件分類與具名取用神。僅提供 traditional 象意依據，不給絕對預測。 */
import type { Chart, Favorability, Palace } from '../qimen/types';
import { aggregate, evaluatePalace, RULE_VERSION } from './rules';

export type EventKind = 'general' | 'wealth' | 'negotiation' | 'travel' | 'visit' | 'study' | 'rest';

export interface EventProfile {
  id: EventKind;
  label: string;
  sourceId: string;
  favoredDoors: string[];
  favoredStars: string[];
  note: string;
}

export const EVENT_PROFILES: readonly EventProfile[] = [
  { id: 'general', label: '一般', sourceId: 'yongshen-general-v1', favoredDoors: ['開門', '生門', '休門'], favoredStars: ['天心', '天任', '天輔'], note: '以吉門吉星為基本取用。' },
  { id: 'wealth', label: '求財／經營', sourceId: 'yongshen-wealth-v1', favoredDoors: ['生門', '開門'], favoredStars: ['天任', '天禽'], note: '取生門、天任為財象；不作收益保證。' },
  { id: 'negotiation', label: '談判／合作', sourceId: 'yongshen-negotiation-v1', favoredDoors: ['開門', '休門'], favoredStars: ['天輔', '天心'], note: '取開門、天輔為和合之象。' },
  { id: 'travel', label: '出行', sourceId: 'yongshen-travel-v1', favoredDoors: ['生門', '開門'], favoredStars: ['天任', '天英'], note: '取生門與驛馬方位；不推測路線。' },
  { id: 'visit', label: '拜訪', sourceId: 'yongshen-visit-v1', favoredDoors: ['休門', '開門'], favoredStars: ['天輔', '天心'], note: '取休門為相見之象。' },
  { id: 'study', label: '學習考試', sourceId: 'yongshen-study-v1', favoredDoors: ['開門', '杜門'], favoredStars: ['天輔', '天心'], note: '天輔為文星；杜門利靜修，不作成績預測。' },
  { id: 'rest', label: '休息', sourceId: 'yongshen-rest-v1', favoredDoors: ['休門'], favoredStars: ['天心', '天芮'], note: '取休門為安息之象。' },
];

export interface DirectionAssessment {
  palaceId: number;
  favorability: Favorability;
  reasons: string[];
  ruleIds: string[];
  yongshen: boolean;
}

export interface AnalysisResult {
  event: EventKind;
  profileVersion: string;
  sourceId: string;
  note: string;
  directions: DirectionAssessment[];
}

export function analyzeChart(chart: Chart, event: EventKind): AnalysisResult {
  const profile = EVENT_PROFILES.find((p) => p.id === event) ?? EVENT_PROFILES[0]!;
  const directions = chart.palaces
    .filter((p) => p.id !== 5)
    .map((p) => {
      const rules = evaluatePalace(chart, p);
      const yongshen = !!(p.door && profile.favoredDoors.includes(p.door)) ||
        p.stars.some((s) => profile.favoredStars.includes(s));
      if (yongshen) {
        rules.push({
          ruleId: 'event.yongshen',
          version: RULE_VERSION,
          sourceId: profile.sourceId,
          favorability: 'favorable',
          reason: `${profile.label}取用神：${p.door ?? ''} ${p.stars.join('')}`,
        });
      }
      return {
        palaceId: p.id,
        favorability: aggregate(rules),
        reasons: rules.map((r) => r.reason),
        ruleIds: rules.map((r) => r.ruleId),
        yongshen,
      };
    });
  return {
    event,
    profileVersion: RULE_VERSION,
    sourceId: profile.sourceId,
    note: profile.note,
    directions,
  };
}

export function palaceLabel(palace: Palace): string {
  return `${palace.id}宮`;
}
