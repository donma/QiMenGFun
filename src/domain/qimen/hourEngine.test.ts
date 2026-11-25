import { describe, expect, it } from 'vitest';
import { computeHourChart, HOUR_PROFILE_ID } from './hourEngine';
import { computeKeChart, keTimeIndex, KE_PROFILE_ID } from './keEngine';
import { termAt } from '../calendar/solarTerms';
import { civilParts, resolveCivilInput } from '../calendar/timezone';
import { dayGanzhi, hourGanzhi } from '../calendar/ganzhi';
import { equationOfTimeMinutes, solarClock } from '../calendar/solarTime';
import type { ChartInput } from './types';

const input = (iso: string, overrides: Partial<ChartInput> = {}): ChartInput => ({
  instantMs: Date.parse(iso),
  timezone: 'Asia/Taipei',
  basis: 'civil',
  profileId: HOUR_PROFILE_ID,
  ...overrides,
});

describe('節氣與干支曆', () => {
  it('小寒 2026 交節瞬間與來源一致（16:23:10 UTC+8）', () => {
    const b = Date.parse('2026-01-05T08:23:10Z');
    expect(termAt(b - 1000).name).toBe('冬至');
    expect(termAt(b + 1000).name).toBe('小寒');
  });

  it('日柱與時柱：2026-01-05 16:23 己卯、壬申', () => {
    expect(dayGanzhi(2026, 1, 5)).toBe('己卯');
    expect(hourGanzhi('己', 16)).toBe('壬申');
  });

  it('子初 23:00 換日', () => {
    expect(dayGanzhi(2026, 1, 5)).toBe('己卯');
    // 時家引擎以 23 點為次日干支日
    const before = computeHourChart(input('2026-01-05T22:59:00+08:00'));
    const after = computeHourChart(input('2026-01-05T23:00:00+08:00'));
    expect(before.status).toBe('ok');
    expect(after.status).toBe('ok');
    if (before.status === 'ok' && after.status === 'ok') {
      expect(before.chart.pillars.day).toBe('己卯');
      expect(after.chart.pillars.day).toBe('庚辰');
    }
  });

  it('DST 重複與不存在時間', () => {
    const dup = resolveCivilInput({ year: 2025, month: 11, day: 2, hour: 1, minute: 30, second: 0 }, 'America/New_York');
    expect(dup.status).toBe('ambiguous');
    const pick = resolveCivilInput({ year: 2025, month: 11, day: 2, hour: 1, minute: 30, second: 0 }, 'America/New_York', -240);
    expect(pick.status).toBe('ok');
    const gap = resolveCivilInput({ year: 2025, month: 3, day: 9, hour: 2, minute: 30, second: 0 }, 'America/New_York');
    expect(gap.status).toBe('nonexistent');
  });

  it('均時差與太陽鐘面（東經 120、正午附近）', () => {
    const eot = equationOfTimeMinutes(Date.parse('2026-01-05T04:00:00Z'));
    expect(Number.isFinite(eot)).toBe(true);
    const sc = solarClock(Date.parse('2026-01-05T04:00:00Z'), 120);
    expect(sc.correctionMinutes).toBeCloseTo(480 + eot, 5);
  });
});

describe('時家轉盤拆補 — 來源錨點', () => {
  it('2026-01-05 16:23：冬至、己卯、壬申、上元、陽一局', () => {
    const result = computeHourChart(input('2026-01-05T16:23:00+08:00'));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    const c = result.chart;
    expect(c.term).toBe('冬至');
    expect(c.pillars.day).toBe('己卯');
    expect(c.pillars.hour).toBe('壬申');
    expect(c.yuan).toBe('upper');
    expect(c.dun).toBe('yang');
    expect(c.ju).toBe(1);
    expect(c.dutyStar).toBe('天蓬');
    expect(c.dutyDoor).toBe('休門');
    expect(c.palaces.find((p) => p.id === 2)?.stars).toContain('天蓬');
    expect(c.palaces.find((p) => p.id === 9)?.door).toBe('休門');
  });

  it('2026-01-05 16:24：小寒、上元、陽二局', () => {
    const result = computeHourChart(input('2026-01-05T16:24:00+08:00'));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    const c = result.chart;
    expect(c.term).toBe('小寒');
    expect(c.ju).toBe(2);
    expect(c.dutyStar).toBe('天芮');
    expect(c.dutyDoor).toBe('死門');
    expect(c.palaces.find((p) => p.id === 6)?.stars).toContain('天芮');
    expect(c.palaces.find((p) => p.id === 1)?.door).toBe('死門');
  });
});

describe('時家完整盤 fixture — 白話命理 2024-12-25 12:00 UTC+8', () => {
  it('陽遁四局：四柱、值符值使、九宮逐欄比對', () => {
    const r = computeHourChart(input('2024-12-25T12:00:00+08:00'));
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    const c = r.chart;
    expect(c.term).toBe('冬至');
    expect(c.yuan).toBe('lower');
    expect(c.fuTou).toBe('己未');
    expect(c.dun).toBe('yang');
    expect(c.ju).toBe(4);
    expect(c.pillars).toEqual({ year: '甲辰', month: '丙子', day: '癸亥', hour: '戊午' });
    expect(c.xunHead).toBe('甲寅');
    expect(c.dutyStar).toBe('天英');
    expect(c.dutyDoor).toBe('景門');
    const at = (id: number) => c.palaces.find((p) => p.id === id)!;
    const expected: Record<number, { earth: string; heaven: string[]; stars: string[]; door: string; deity: string }> = {
      4: { earth: '戊', heaven: ['癸'], stars: ['天英'], door: '景門', deity: '值符' },
      9: { earth: '癸', heaven: ['丙', '己'], stars: ['天芮', '天禽'], door: '死門', deity: '螣蛇' },
      2: { earth: '丙', heaven: ['辛'], stars: ['天柱'], door: '驚門', deity: '太陰' },
      3: { earth: '乙', heaven: ['戊'], stars: ['天輔'], door: '杜門', deity: '九天' },
      5: { earth: '己', heaven: [], stars: [], door: '', deity: '' },
      7: { earth: '辛', heaven: ['庚'], stars: ['天心'], door: '開門', deity: '六合' },
      8: { earth: '壬', heaven: ['乙'], stars: ['天沖'], door: '傷門', deity: '九地' },
      1: { earth: '丁', heaven: ['壬'], stars: ['天任'], door: '生門', deity: '玄武' },
      6: { earth: '庚', heaven: ['丁'], stars: ['天蓬'], door: '休門', deity: '白虎' },
    };
    for (const [id, e] of Object.entries(expected)) {
      const p = at(Number(id));
      expect(p.earthStems, `宮 ${id} 地盤`).toEqual([e.earth]);
      expect(p.heavenStems, `宮 ${id} 天盤`).toEqual(e.heaven);
      expect(p.stars, `宮 ${id} 星`).toEqual(e.stars);
      expect(p.door, `宮 ${id} 門`).toBe(e.door || null);
      expect(p.deity, `宮 ${id} 神`).toBe(e.deity || null);
    }
    expect(c.emptyBranches).toEqual(['子', '丑']);
  });
});

describe('時家完整盤 fixture（續）', () => {
  it('2026-06-15 12:00 芒種下元陽遁九局', () => {
    const r = computeHourChart(input('2026-06-15T12:00:00+08:00'));
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    const c = r.chart;
    expect(c.ju).toBe(9);
    expect(c.pillars).toEqual({ year: '丙午', month: '甲午', day: '庚申', hour: '壬午' });
    expect(c.xunHead).toBe('甲戌');
    expect(c.dutyStar).toBe('天蓬');
    expect(c.dutyDoor).toBe('休門');
    const at = (id: number) => c.palaces.find((p) => p.id === id)!;
    expect(at(4).earthStems).toEqual(['壬']);
    expect(at(4).stars).toEqual(['天蓬']);
    expect(at(4).deity).toBe('值符');
    expect(at(9).door).toBe('休門');
    expect(at(1).heavenStems).toEqual(['庚', '癸']); // 天芮寄天禽雙干
  });

  it('2026-07-15 12:00 小暑下元陰遁五局（中五寄坤、陰遁神序）', () => {
    const r = computeHourChart(input('2026-07-15T12:00:00+08:00'));
    expect(r.status).toBe('ok');
    if (r.status !== 'ok') return;
    const c = r.chart;
    expect(c.dun).toBe('yin');
    expect(c.ju).toBe(5);
    expect(c.pillars).toEqual({ year: '丙午', month: '乙未', day: '庚寅', hour: '壬午' });
    expect(c.fuTou).toBe('己丑');
    expect(c.dutyStar).toBe('天輔');
    expect(c.dutyDoor).toBe('杜門');
    const at = (id: number) => c.palaces.find((p) => p.id === id)!;
    expect(at(1).stars).toEqual(['天輔']);
    expect(at(1).deity).toBe('值符');
    expect(at(2).door).toBe('杜門'); // 值使落中五寄坤
    expect(at(3).stars).toEqual(['天芮', '天禽']);
    expect(at(3).heavenStems).toEqual(['辛', '戊']); // 主寄雙干
    expect(at(6).deity).toBe('螣蛇'); // 陰遁逆行神序
    expect(at(7).deity).toBe('太陰');
    expect(at(9).deity).toBe('白虎');
    expect(at(4).deity).toBe('玄武');
    expect(at(8).deity).toBe('九天');
  });
});

describe('時家性質', () => {
  it('地盤九干不重複、八門八神各一次', () => {
    for (let h = 0; h < 24; h += 1) {
      const result = computeHourChart(input(`2026-06-15T${String(h).padStart(2, '0')}:30:00+08:00`));
      expect(result.status).toBe('ok');
      if (result.status !== 'ok') continue;
      const earth = result.chart.palaces.map((p) => p.earthStems[0]);
      expect(new Set(earth).size).toBe(9);
      const doors = result.chart.palaces.map((p) => p.door).filter(Boolean);
      expect(new Set(doors).size).toBe(8);
      const deities = result.chart.palaces.map((p) => p.deity).filter(Boolean);
      expect(new Set(deities).size).toBe(8);
    }
  });

  it('中五寄坤：天禽與主宮雙干皆保留', () => {
    let foundHosted = false;
    for (let d = 0; d < 60 && !foundHosted; d += 1) {
      const base = Date.parse('2026-01-01T00:00:00Z') + d * 86_400_000 + 8 * 3_600_000;
      const result = computeHourChart({ instantMs: base, timezone: 'Asia/Taipei', basis: 'civil', profileId: HOUR_PROFILE_ID });
      if (result.status === 'ok') {
        foundHosted = result.chart.palaces.some((p) => p.hostedFrom.includes(5) && p.heavenStems.length >= 2 && p.stars.includes('天禽'));
      }
    }
    expect(foundHosted).toBe(true);
  });

  it('同輸入 hash 一致；不同局 hash 不同', () => {
    const a = computeHourChart(input('2026-01-05T16:23:00+08:00'));
    const b = computeHourChart(input('2026-01-05T16:23:00+08:00'));
    const c = computeHourChart(input('2026-01-05T16:24:00+08:00'));
    expect(a.status).toBe('ok'); expect(b.status).toBe('ok'); expect(c.status).toBe('ok');
    if (a.status === 'ok' && b.status === 'ok' && c.status === 'ok') {
      expect(a.chart.hash).toBe(b.chart.hash);
      expect(a.chart.hash).not.toBe(c.chart.hash);
    }
  });

  it('真太陽時需有效經度', () => {
    const r = computeHourChart(input('2026-01-05T16:23:00+08:00', { basis: 'apparent-solar' }));
    expect(r.status).toBe('invalid');
    const ok = computeHourChart(input('2026-01-05T16:23:00+08:00', { basis: 'apparent-solar', longitude: 121.5 }));
    expect(ok.status).toBe('ok');
  });

  it('時區民用時間正確（含 DST offset）', () => {
    expect(civilParts(Date.parse('2025-07-01T12:00:00Z'), 'America/New_York').offsetMinutes).toBe(-240);
    expect(civilParts(Date.parse('2025-01-01T12:00:00Z'), 'America/New_York').offsetMinutes).toBe(-300);
  });
});

describe('刻家阻斷', () => {
  it('正式排盤回傳 unverified', () => {
    const r = computeKeChart(input('2026-01-05T16:23:00+08:00', { profileId: KE_PROFILE_ID }));
    expect(r.status).toBe('unverified');
  });

  it('12 刻時間索引覆蓋整時辰', () => {
    const base = input('2026-01-05T15:00:00+08:00', { profileId: KE_PROFILE_ID });
    const indices: number[] = [];
    for (let m = 0; m < 120; m += 1) {
      indices.push(keTimeIndex(base, Date.parse('2026-01-05T15:00:00+08:00') + m * 60_000).keIndex);
    }
    expect(new Set(indices).size).toBe(12);
    for (let k = 0; k < 12; k += 1) expect(indices).toContain(k);
  });
});
