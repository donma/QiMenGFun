/**
 * 時家轉盤拆補引擎 — profile `hour-zhuan-chaibu-v1`。
 * 純函式，不接觸 DOM / React / 系統當前時間。
 *
 * 驗證錨點（白話命理 2026-11-19，tyme4ts 節氣）：
 *  2026-01-05 16:23 UTC+8：冬至、己卯日、壬申時、上元、陽一局
 *    值符天蓬落坤二；值使休門落離九
 *  2026-01-05 16:24 UTC+8：小寒、己卯日、壬申時、上元、陽二局
 *    值符天芮落乾六；值使死門落坎一
 */
import { civilParts, formatOffset } from '../calendar/timezone';
import { dayGanzhiIndex, fuTouForDay, hourGanzhi, monthGanzhi, yearGanzhi } from '../calendar/ganzhi';
import { jieAt, lichunInstantMs, termAt } from '../calendar/solarTerms';
import { solarClock, isValidLongitude } from '../calendar/solarTime';
import {
  DEITIES, DOORS_BY_PALACE, EARTH_STEM_ORDER, JU_TABLE, RING, TERMS,
  STARS_BY_PALACE, XUN_HIDDEN_STEMS, YUAN_INDEX, YUAN_NAME,
  emptyBranchesForXun, ganzhiAt, ganzhiIndex, palaceAtRing, ringIndex, yiMaForDay,
  BRANCH_PALACE, PALACES,
} from './tables';
import type {
  Chart, ChartInput, ChartResult, Dun, Palace, PalaceId, RuleTrace, Yuan,
} from './types';

export const HOUR_PROFILE_ID = 'hour-zhuan-chaibu-v1';
export const HOUR_PROFILE_VERSION = '1.0.0';

interface ClockView {
  date: { year: number; month: number; day: number };
  minutesOfDay: number;
  clockHour: number;
  pillarDate: { year: number; month: number; day: number };
  offsetMinutes: number;
  correctionMinutes: number;
  crossedDate: boolean;
}

function addDaysTo(date: { year: number; month: number; day: number }, days: number) {
  const d = new Date(Date.UTC(date.year, date.month - 1, date.day + days));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function clockView(input: ChartInput): ClockView {
  if (input.basis === 'apparent-solar') {
    if (!isValidLongitude(input.longitude)) {
      throw new Error('真太陽時需要有效經度（-180..180）。');
    }
    const sc = solarClock(input.instantMs, input.longitude);
    const pillarDate = sc.minutesOfDay >= 23 * 60 ? addDaysTo(sc.date, 1) : sc.date;
    return {
      date: sc.date,
      minutesOfDay: sc.minutesOfDay,
      clockHour: Math.floor(sc.minutesOfDay / 60),
      pillarDate,
      offsetMinutes: 0,
      correctionMinutes: sc.correctionMinutes,
      crossedDate: sc.crossedDate,
    };
  }
  const c = civilParts(input.instantMs, input.timezone);
  const date = { year: c.year, month: c.month, day: c.day };
  const minutes = c.hour * 60 + c.minute + c.second / 60;
  return {
    date,
    minutesOfDay: minutes,
    clockHour: c.hour,
    pillarDate: c.hour >= 23 ? addDaysTo(date, 1) : date,
    offsetMinutes: c.offsetMinutes,
    correctionMinutes: 0,
    crossedDate: false,
  };
}

/** 時支索引：子 23–01，其後每兩小時一支。 */
function branchIndexFromMinutes(minutesOfDay: number): number {
  return Math.floor((((minutesOfDay + 60) % 1440 + 1440) % 1440) / 120);
}

function palaceOfStem(earth: Record<PalaceId, string>, stem: string): PalaceId {
  const found = Object.keys(earth).find((id) => earth[id as unknown as PalaceId] === stem);
  return found === undefined ? 5 : (Number(found) as PalaceId);
}

function walkPalace(from: PalaceId, steps: number, dun: Dun): PalaceId {
  let p = from;
  for (let i = 0; i < steps; i += 1) {
    if (dun === 'yang') p = (p === 9 ? 1 : p + 1) as PalaceId;
    else p = (p === 1 ? 9 : p - 1) as PalaceId;
  }
  return p;
}

/** 求鐘面等於 targetMinutes（-60..1500，可跨日）的最近 UTC instant。 */
function clockAt(instantMs: number, targetMinutes: number, view: ClockView, input: ChartInput): number {
  let candidate = instantMs + (targetMinutes - view.minutesOfDay) * 60_000;
  for (let i = 0; i < 4; i += 1) {
    const next = input.basis === 'apparent-solar'
      ? solarClock(candidate, input.longitude!).minutesOfDay
      : (() => { const c = civilParts(candidate, input.timezone); return c.hour * 60 + c.minute + c.second / 60; })();
    let diff = next - targetMinutes;
    if (diff > 720) diff -= 1440;
    if (diff < -720) diff += 1440;
    if (Math.abs(diff) < 0.01) break;
    candidate -= diff * 60_000;
  }
  return Math.round(candidate);
}

function fnv1a(text: string): string {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function trace(ruleId: string, sourceId: string, inputs: Record<string, unknown>, outcome: string): RuleTrace {
  return { ruleId, sourceId, inputs, outcome };
}

export function computeHourChart(input: ChartInput): ChartResult {
  try {
    if (!Number.isFinite(input.instantMs)) return { status: 'invalid', reason: '時刻必須是 UTC epoch 毫秒。' };
    if (input.profileId !== HOUR_PROFILE_ID) return { status: 'unsupported', reason: `未知的時家 profile：${input.profileId}` };
    if (input.basis === 'apparent-solar' && !isValidLongitude(input.longitude)) {
      return { status: 'invalid', reason: '真太陽時需要有效經度。' };
    }
    try { new Intl.DateTimeFormat('en-US', { timeZone: input.timezone }); }
    catch { return { status: 'invalid', reason: `無效 IANA 時區：${input.timezone}` }; }

    const view = clockView(input);
    const bIdx = branchIndexFromMinutes(view.minutesOfDay);
    const dayIndex = dayGanzhiIndex(view.pillarDate.year, view.pillarDate.month, view.pillarDate.day);
    const day = ganzhiAt(dayIndex);
    const hour = hourGanzhi(day.slice(0, 1), view.clockHour);
    const fuTou = fuTouForDay(dayIndex);
    const yuan: Yuan = ['子', '午', '卯', '酉'].includes(fuTou.slice(1)) ? 'upper'
      : ['寅', '申', '巳', '亥'].includes(fuTou.slice(1)) ? 'middle' : 'lower';

    const termInfo = termAt(input.instantMs);
    const dun: Dun = TERMS.indexOf(termInfo.name) < 12 ? 'yang' : 'yin';
    const juRow = JU_TABLE[termInfo.name];
    if (!juRow) return { status: 'error', reason: `節氣 ${termInfo.name} 缺少局數表。` };
    const ju = juRow[YUAN_INDEX[yuan]]!;

    // 1. 地盤：自局數宮起，戊己庚辛壬癸丁丙乙，陽順陰逆數序。
    const earth = {} as Record<PalaceId, string>;
    EARTH_STEM_ORDER.forEach((stem, i) => {
      const offset = dun === 'yang' ? i : -i;
      const palace = ((((ju - 1 + offset) % 9 + 9) % 9) + 1) as PalaceId;
      earth[palace] = stem;
    });

    // 2. 旬首與原值符／值使。
    const hourIndex = ganzhiIndex(hour.slice(0, 1), hour.slice(1));
    const xunStart = Math.floor(hourIndex / 10) * 10;
    const xunHead = ganzhiAt(xunStart);
    const xunStem = XUN_HIDDEN_STEMS[xunStart / 10] ?? '戊';
    const xunPalace = palaceOfStem(earth, xunStem);
    const dutyStar = STARS_BY_PALACE[xunPalace]!;
    const dutyDoor = DOORS_BY_PALACE[xunPalace] ?? DOORS_BY_PALACE[2]!;

    // 3. 天盤：值符隨時干地盤落宮，星與天干沿環序同步轉動；中五寄坤保留雙干。
    const hourStem = hour.slice(0, 1);
    const effectiveHourStem = hourStem === '甲' ? xunStem : hourStem;
    const hourPalace = palaceOfStem(earth, effectiveHourStem);
    const starDelta = (ringIndex(hourPalace) - ringIndex(xunPalace) + 8) % 8;

    const starAt = {} as Record<PalaceId, string[]>;
    const heavenAt = {} as Record<PalaceId, string[]>;
    const hostedAt = {} as Record<PalaceId, PalaceId[]>;
    for (const p of Object.values(PALACES)) {
      starAt[p.id] = [];
      heavenAt[p.id] = [];
      hostedAt[p.id] = [];
    }
    for (let i = 0; i < 8; i += 1) {
      const src = palaceAtRing(i);
      const dst = palaceAtRing(i + starDelta);
      starAt[dst]!.push(STARS_BY_PALACE[src]!);
      heavenAt[dst]!.push(earth[src]!);
      if (src === 2) {
        starAt[dst]!.push(STARS_BY_PALACE[5]!);
        heavenAt[dst]!.push(earth[5]!);
        hostedAt[dst]!.push(5);
      }
    }

    // 4. 值使門：旬首宮按旬內步數數序走宮，八門依環序配置。
    const steps = hourIndex % 10;
    const doorLand = walkPalace(xunPalace, steps, dun);
    const doorDelta = (ringIndex(doorLand) - ringIndex(xunPalace) + 8) % 8;
    const doorAt = {} as Record<PalaceId, string | null>;
    for (const p of Object.values(PALACES)) doorAt[p.id] = null;
    for (let i = 0; i < 8; i += 1) {
      const src = palaceAtRing(i);
      const dst = palaceAtRing(i + doorDelta);
      doorAt[dst] = DOORS_BY_PALACE[src] ?? null;
    }

    // 5. 八神：值符落宮起值符，陽順陰逆。
    const deityAt = {} as Record<PalaceId, string | null>;
    for (const p of Object.values(PALACES)) deityAt[p.id] = null;
    const deities = DEITIES[dun];
    for (let k = 0; k < 8; k += 1) {
      const idx = (ringIndex(hourPalace) + (dun === 'yang' ? k : -k) + 80) % 8;
      deityAt[palaceAtRing(idx)] = deities[k] ?? null;
    }

    // 6. 旬空、驛馬、日干／時干落宮。
    const empties = emptyBranchesForXun(xunHead);
    const yiMa = yiMaForDay(day.slice(1));
    const yiMaPalace = BRANCH_PALACE[yiMa] ?? 1;
    const dayStemPalace = palaceOfStem(earth, day.slice(0, 1));
    const marks = {} as Record<PalaceId, string[]>;
    for (const p of Object.values(PALACES)) marks[p.id] = [];
    for (const b of empties) {
      const p = BRANCH_PALACE[b];
      if (p && !marks[p]!.includes('旬空')) marks[p]!.push('旬空');
    }
    if (!marks[yiMaPalace]!.includes('驛馬')) marks[yiMaPalace]!.push('驛馬');
    if (!marks[dayStemPalace]!.includes('日干')) marks[dayStemPalace]!.push('日干');
    if (!marks[hourPalace]!.includes('時干')) marks[hourPalace]!.push('時干');

    const palaces: Palace[] = Object.values(PALACES)
      .map((def) => ({
        id: def.id,
        earthStems: [earth[def.id]!],
        heavenStems: heavenAt[def.id]!,
        stars: starAt[def.id]!,
        door: doorAt[def.id] ?? null,
        deity: deityAt[def.id] ?? null,
        hostedFrom: hostedAt[def.id]!,
        markers: marks[def.id]!,
      }))
      .sort((a, b) => a.id - b.id);

    // 有效區間：下一個時支邊界與交節邊界取較早者。
    const branchStart = bIdx * 120 - 60;
    const validFromMs = clockAt(input.instantMs, branchStart, view, input);
    let validUntilMs = clockAt(input.instantMs, branchStart + 120, view, input);
    if (validUntilMs > termInfo.untilMs) validUntilMs = termInfo.untilMs;

    const lichun = lichunInstantMs(view.date.year);
    const yearPillar = yearGanzhi(view.date.year, input.instantMs, lichun);
    const monthPillar = monthGanzhi(yearPillar.slice(0, 1), jieAt(input.instantMs));

    const traces: RuleTrace[] = [
      trace('calendar.term', 'tyme4ts-1.5.6', { instantMs: input.instantMs }, `${termInfo.name}（交節 ${new Date(termInfo.fromMs).toISOString()}）`),
      trace('calendar.pillar', 'JDN+49 / 子初23:00', { date: view.pillarDate, minutesOfDay: view.minutesOfDay }, `${yearPillar} ${monthPillar} ${day} ${hour}`),
      trace('qimen.futou', 'chaibu-5day', { dayIndex }, `${fuTou} → ${YUAN_NAME[yuan]}`),
      trace('qimen.ju', '二至還鄉圖/局數歌', { term: termInfo.name, yuan, dun }, `${dun === 'yang' ? '陽遁' : '陰遁'}${ju}局`),
      trace('qimen.earth', HOUR_PROFILE_ID, { ju, dun }, EARTH_STEM_ORDER.map((s, i) => `${s}@${((ju - 1 + (dun === 'yang' ? i : -i)) % 9 + 9) % 9 + 1}`).join(' ')),
      trace('qimen.duty', HOUR_PROFILE_ID, { hour, xunHead, xunStem }, `值符${dutyStar} 原宮${xunPalace}；值使${dutyDoor}`),
      trace('qimen.stars', HOUR_PROFILE_ID, { hourPalace, xunPalace, starDelta }, `值符落宮 ${hourPalace}（寄坤規則保留雙干）`),
      trace('qimen.doors', HOUR_PROFILE_ID, { doorLand, doorDelta }, `值使落宮 ${doorLand}`),
      trace('qimen.deities', HOUR_PROFILE_ID, { dun }, DEITIES[dun].join(' ')),
      trace('qimen.markers', HOUR_PROFILE_ID, { xunHead, day, yiMa }, `旬空 ${empties.join('')}；驛馬 ${yiMa}`),
      trace('time.basis', input.basis, { offsetMinutes: view.offsetMinutes, correctionMinutes: view.correctionMinutes }, input.basis === 'civil' ? formatOffset(view.offsetMinutes) : `真太陽時修正 ${view.correctionMinutes.toFixed(2)} 分`),
    ];

    const core = {
      kind: 'hour', profileVersion: HOUR_PROFILE_VERSION, validFromMs, validUntilMs,
      dun, ju, yuan, term: termInfo.name, fuTou, pillars: { year: yearPillar, month: monthPillar, day, hour },
      xunHead, dutyStar, dutyDoor, palaces, empties,
    };
    const chart: Chart = {
      kind: 'hour',
      input,
      profileVersion: HOUR_PROFILE_VERSION,
      validFromMs,
      validUntilMs,
      dun,
      ju,
      yuan,
      term: termInfo.name,
      fuTou,
      pillars: core.pillars,
      xunHead,
      dutyStar,
      dutyDoor,
      palaces,
      trace: traces,
      emptyBranches: empties,
      hash: fnv1a(JSON.stringify(core)),
    };
    return { status: 'ok', chart };
  } catch (err) {
    return { status: 'error', reason: err instanceof Error ? err.message : String(err) };
  }
}

/** 供 TimeController：相關規則事件的下一個 UTC 時刻。 */
export function nextHourBoundaryMs(instantMs: number, input: ChartInput): number {
  const view = clockView(input);
  const bIdx = branchIndexFromMinutes(view.minutesOfDay);
  const start = bIdx * 120 - 60;
  let target = start + 120;
  if (target - view.minutesOfDay <= 0) target += 1440;
  return clockAt(instantMs, target, view, input);
}

export { RING };
