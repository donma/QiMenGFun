import { describe, expect, it } from 'vitest';
import { computeHourChart, HOUR_PROFILE_ID } from '../qimen/hourEngine';
import { analyzeChart, EVENT_PROFILES, type EventKind } from './eventProfiles';
import { chartOverlap } from './overlap';
import { analyzeYearLife } from './yearLife';
import { UNSUPPORTED_RULES } from './rules';
import type { Chart, Palace } from '../qimen/types';

const chartAt = (iso: string): Chart => {
  const r = computeHourChart({ instantMs: Date.parse(iso), timezone: 'Asia/Taipei', basis: 'civil', profileId: HOUR_PROFILE_ID });
  if (r.status !== 'ok') throw new Error(r.reason);
  return r.chart;
};

/** 只含一個宮位的合成盤，用來逐條驗證判定規則。 */
const synthetic = (p: Partial<Palace>, kind: 'hour' | 'ke' = 'hour'): Chart => ({
  kind,
  palaces: [{ id: 1, earthStems: ['戊'], heavenStems: [], stars: [], door: null, deity: null, hostedFrom: [], markers: [], ...p }],
} as unknown as Chart);
const verdict = (p: Partial<Palace>, ev: EventKind = 'general') => analyzeChart(synthetic(p), ev).directions[0]!.favorability;

describe('方位判定規則（取用神＋凶象）', () => {
  it('有取用神、無凶象 → 宜（綠）', () => {
    expect(verdict({ door: '生門' })).toBe('favorable');
    expect(verdict({ stars: ['天心'] })).toBe('favorable');
  });

  it('中性的星門、吉神不會把「宜」擋掉', () => {
    expect(verdict({ door: '生門', stars: ['天沖'], deity: '九地' })).toBe('favorable');
  });

  it('有取用神但同時有凶象 → 吉凶並見', () => {
    expect(verdict({ door: '生門', deity: '白虎' })).toBe('mixed');
    expect(verdict({ door: '開門', stars: ['天蓬'] })).toBe('mixed');
    expect(verdict({ door: '休門', markers: ['旬空'] })).toBe('mixed');
  });

  it('只有凶象 → 宜慎；兩者皆無 → 平', () => {
    expect(verdict({ door: '死門' })).toBe('caution');
    expect(verdict({ door: '傷門', stars: ['天英'] })).toBe('neutral');
    expect(verdict({ door: '傷門', deity: '太陰' })).toBe('neutral');
  });

  it('切換事件會改變取用神：杜門對學習為宜、對一般為平', () => {
    expect(verdict({ door: '杜門' }, 'general')).toBe('neutral');
    expect(verdict({ door: '杜門' }, 'study')).toBe('favorable');
    expect(verdict({ door: '休門' }, 'wealth')).toBe('neutral');
    expect(verdict({ door: '休門' }, 'rest')).toBe('favorable');
  });

  it('驛馬只對出行是取用神', () => {
    expect(verdict({ door: '傷門', markers: ['驛馬'] }, 'general')).toBe('neutral');
    expect(verdict({ door: '傷門', markers: ['驛馬'] }, 'travel')).toBe('favorable');
  });

  it('每個事件都有明確的取用神定義', () => {
    for (const p of EVENT_PROFILES) expect(p.favoredDoors.length + p.favoredStars.length + p.favoredMarkers.length).toBeGreaterThan(0);
  });

  it('刻家盤一律 unknown，不給吉凶', () => {
    const a = analyzeChart(synthetic({ door: '生門' }, 'ke'), 'general');
    expect(a.directions.every((d) => d.favorability === 'unknown')).toBe(true);
  });

  it('未驗證的進階格局明確列為不支援', () => {
    expect(UNSUPPORTED_RULES.length).toBeGreaterThan(0);
  });
});

describe('真實盤局：事件確實會改變結果', () => {
  it('同一時段切換事件，綠色方位在多數日子裡不全相同', () => {
    let differ = 0;
    let total = 0;
    for (let d = 0; d < 20; d += 1) {
      for (let h = 0; h < 12; h += 1) {
        const c = chartAt(new Date(Date.parse('2026-11-26T00:30:00+08:00') + d * 86_400_000 + h * 2 * 3_600_000).toISOString());
        const sets = new Set(EVENT_PROFILES.map((p) => analyzeChart(c, p.id).directions.filter((x) => x.favorability === 'favorable').map((x) => x.palaceId).join(',')));
        total += 1;
        if (sets.size > 1) differ += 1;
      }
    }
    expect(differ / total).toBeGreaterThan(0.5);
  });

  it('綠色一定有取用神、且一定沒有凶象（逐宮驗證）', () => {
    const c = chartAt('2026-01-05T16:23:00+08:00');
    for (const p of EVENT_PROFILES) {
      const a = analyzeChart(c, p.id);
      for (const dir of a.directions) {
        if (dir.favorability !== 'favorable') continue;
        const pal = c.palaces.find((x) => x.id === dir.palaceId)!;
        expect(dir.yongshen).toBe(true);
        expect(['死門', '驚門']).not.toContain(pal.door);
        expect(pal.stars.some((s) => ['天蓬', '天芮', '天柱'].includes(s))).toBe(false);
        expect(['白虎', '玄武', '螣蛇']).not.toContain(pal.deity);
        expect(pal.markers).not.toContain('旬空');
      }
    }
  });
});

describe('雙盤交集與年命', () => {
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
    expect(analyzeYearLife({ date: '2026-02-04', time: null, timezone: 'Asia/Taipei' }, c).status).toBe('uncertain');
  });
});
