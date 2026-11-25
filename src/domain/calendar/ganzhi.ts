/**
 * 干支與儒略日。所有計算以 UTC epoch / Gregorian 日期為輸入，
 * 不依賴本機 Date 的隱含時區。子初 23:00 換干支日。
 */
import { STEMS, BRANCHES, ganzhiAt, ganzhiIndex, yuanOfFuTou } from '../qimen/tables';
import type { Yuan } from '../qimen/types';

/** Gregorian 日期 → 儒略日（含小數時分秒可選）。 */
export function julianDayNumber(year: number, month: number, day: number): number {
  const y = month <= 2 ? year - 1 : year;
  const m = month <= 2 ? month + 12 : month;
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + day + b - 1524;
}

/** JDN → Gregorian 日期（UTC 語意）。 */
export function gregorianFromJDN(jdn: number): { year: number; month: number; day: number } {
  const z = Math.floor(jdn + 0.5);
  const a = Math.floor((z - 1867216.25) / 36524.25);
  const b = z + (a > 0 ? 1 + a - Math.floor(a / 4) : 0) + 1524;
  const c = Math.floor((b - 122.1) / 365.25);
  const d = Math.floor(365.25 * c);
  const e = Math.floor((b - d) / 30.6001);
  const day = b - d - Math.floor(30.6001 * e);
  const month = e < 14 ? e - 1 : e - 13;
  const year = month > 2 ? c - 4716 : c - 4715;
  return { year, month, day };
}

export function addDays(date: { year: number; month: number; day: number }, days: number) {
  const jd = julianDayNumber(date.year, date.month, date.day) + days;
  return gregorianFromJDN(jd);
}

/** 日干支座標（甲子 = 0）。錨點：1949-10-01 甲子、2000-01-01 戊午。 */
export function dayGanzhiIndex(year: number, month: number, day: number): number {
  const jdn = julianDayNumber(year, month, day);
  return ((jdn + 49) % 60 + 60) % 60;
}

export function dayGanzhi(year: number, month: number, day: number): string {
  return ganzhiAt(dayGanzhiIndex(year, month, day));
}

/** 時干支：日干定子時天干，23:00 起為次日之子時。 */
export function hourGanzhi(dayStem: string, clockHour: number): string {
  const branch = BRANCHES[(((clockHour + 1) / 2) | 0) % 12] ?? '子';
  const s = (STEMS.indexOf(dayStem as (typeof STEMS)[number]) % 5) * 2; // 子時天干序 0,2,4,6,8
  const b = BRANCHES.indexOf(branch as (typeof BRANCHES)[number]);
  // 子時干支在六十甲子中的索引為 s*6（甲子 0、丙子 12、戊子 24、庚子 36、壬子 48），
  // 之後每一時支 +1。不可直接用 s+b（干支週期不同）。
  return ganzhiAt(s * 6 + b);
}

/** 年干支：立春換年，以立春 UTC 瞬間判定。 */
export function yearGanzhi(civilYear: number, instantMs: number, lichunMs: number): string {
  const y = instantMs >= lichunMs ? civilYear : civilYear - 1;
  return ganzhiAt(y - 4);
}

/** 月干支：十二節換月，寅月起於立春。 */
export function monthGanzhi(yearStem: string, jieName: string): string {
  const jieOrder = ['立春', '驚蟄', '清明', '立夏', '芒種', '小暑', '立秋', '白露', '寒露', '立冬', '大雪', '小寒'];
  const idx = Math.max(0, jieOrder.indexOf(jieName));
  // 年干定寅月之干（甲己丙寅、乙庚戊寅、丙辛庚寅、丁壬壬寅、戊癸甲寅），
  // 其後每月干支依序 +1。
  const yinStem = STEMS[(STEMS.indexOf(yearStem as (typeof STEMS)[number]) % 5) * 2 + 2] ?? '甲';
  const base = ganzhiIndex(yinStem, '寅');
  return ganzhiAt(base + idx);
}

/** 符頭：含當日向前最近之甲日或己日（五日一組起點）。 */
export function fuTouForDay(dayIndex: number): string {
  return ganzhiAt(Math.floor(dayIndex / 5) * 5);
}

export function yuanForDay(dayIndex: number): Yuan {
  return yuanOfFuTou(fuTouForDay(dayIndex));
}
