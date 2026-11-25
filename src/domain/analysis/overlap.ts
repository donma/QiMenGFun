/**
 * 雙盤共振為產品自訂交集，並非傳統定律。
 * 僅同方位、同事件、兩盤皆 favorable 才標交集；任一 unknown 不推共振；
 * 衝突顯示 mixed。不得稱能量加倍。
 */
import type { Favorability } from '../qimen/types';
import type { AnalysisResult, DirectionAssessment } from './eventProfiles';

export interface OverlapEntry {
  palaceId: number;
  favorability: Favorability;
  label: string;
  reason: string;
}

export function chartOverlap(hour: AnalysisResult, ke: AnalysisResult): OverlapEntry[] {
  if (hour.event !== ke.event) return [];
  const keMap = new Map<number, DirectionAssessment>(ke.directions.map((d) => [d.palaceId, d]));
  return hour.directions.map((h) => {
    const k = keMap.get(h.palaceId);
    if (!k) return { palaceId: h.palaceId, favorability: 'unknown' as Favorability, label: '無刻盤資料', reason: '刻家規則尚待驗證' };
    if (h.favorability === 'unknown' || k.favorability === 'unknown') {
      return { palaceId: h.palaceId, favorability: 'unknown' as Favorability, label: '未知', reason: '任一盤含未驗證規則，不推共振' };
    }
    if (h.favorability === 'favorable' && k.favorability === 'favorable') {
      return {
        palaceId: h.palaceId,
        favorability: 'favorable' as Favorability,
        label: '雙盤交集',
        reason: `時盤：${h.reasons.join('、')}；刻盤：${k.reasons.join('、')}。此為產品自訂交集，非傳統定律。`,
      };
    }
    if (h.favorability === 'caution' && k.favorability === 'caution') {
      return { palaceId: h.palaceId, favorability: 'caution' as Favorability, label: '兩盤皆宜慎', reason: '兩盤象意皆屬宜慎' };
    }
    return { palaceId: h.palaceId, favorability: 'mixed' as Favorability, label: '混合', reason: '兩盤象意不一致，保留正反理由' };
  });
}
