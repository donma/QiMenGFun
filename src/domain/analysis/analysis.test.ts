import { describe, expect, it } from 'vitest';
import { computeHourChart, HOUR_PROFILE_ID } from '../qimen/hourEngine';
import { analyzeChart } from './eventProfiles';
import { chartOverlap } from './overlap';
import { analyzeYearLife } from './yearLife';
import { aggregate, evaluatePalace, UNSUPPORTED_RULES, type RuleResult } from './rules';
import type { Chart, Palace } from '../qimen/types';

const chartAt = (iso: string): Chart => {
  const r = computeHourChart({ instantMs: Date.parse(iso), timezone: 'Asia/Taipei', basis: 'civil', profileId: HOUR_PROFILE_ID });
  if (r.status !== 'ok') throw new Error(r.reason);
  return r.chart;
};

const mk = (fav: RuleResult['favorability']): RuleResult[] => [
  { ruleId: 't', version: '1', sourceId: 'test', favorability: fav, reason: 'r' },
];

describe('分析規則', () => {
  it('吉門 favorable、凶門 caution、空白 unknown', () => {
    const p: Palace = { id: 1, earthStems: ['戊'], heavenStems: [], stars: [], door: '生門', deity: null, hostedFrom: [], markers: [] };
    expect(evaluatePalace({ kind: 'hour' } as Chart, p).some((r) => r.favorability === 'favorable')).toBe(true);
    expect(evaluatePalace({ kind: 'hour' } as Chart, { ...p, door: '死門' }).some((r) => r.favorability === 'caution')).toBe(true);
    expect(aggregate([])).toBe('unknown');
  });

  it('衝突保留 mixed；未驗證規則不參與', () => {
    expect(aggregate([...mk('favorable'), ...mk('caution')])).toBe('mixed');
    expect(UNSUPPORTED_RULES.length).toBeGreaterThan(0);
  });

  it('事件切換會改變取用神結果', () => {
    const c = chartAt('2026-01-05T16:23:00+08:00');
    const a = analyzeChart(c, 'general');
    const b = analyzeChart(c, 'wealth');
    expect(a.event).toBe('general');
    expect(b.event).toBe('wealth');
    expect(a.directions).toHaveLength(8);
  });

  it('雙盤交集真值表', () => {
    const h = analyzeChart(chartAt('2026-01-05T16:23:00+08:00'), 'general');
    const k = analyzeChart(chartAt('2026-01-05T16:24:00+08:00'), 'general');
    h.directions.forEach((d) => { d.favorability = 'favorable'; });
    k.directions[0]!.favorability = 'favorable';
    const overlap = chartOverlap(h, k);
    expect(overlap.length).toBe(8);
    const fav = overlap.find((e) => k.directions.find((x) => x.palaceId === e.palaceId)?.favorability === 'favorable');
    expect(fav?.label).toBe('雙盤交集');
    h.directions.forEach((d) => { d.favorability = 'unknown'; });
    expect(chartOverlap(h, k).every((e) => e.favorability === 'unknown')).toBe(true);
  });

  it('年命：無生日不顯示；立春附近缺時間不猜', () => {
    const c = chartAt('2026-01-05T16:23:00+08:00');
    expect(analyzeYearLife({ date: null, time: null, timezone: 'Asia/Taipei' }, c).status).toBe('unavailable');
    const near = analyzeYearLife({ date: '2026-02-04', time: null, timezone: 'Asia/Taipei' }, c);
    expect(near.status).toBe('uncertain');
  });
});
