/**
 * 真太陽時：NOAA 均時差公式。
 * solar clock = UTC 分鐘 + 4 × 經度(東正西負) + EoT，再正規化日期。
 * 無效經度不得宣稱真太陽時。
 */
import { gregorianFromJDN } from './ganzhi';

const DAY_MS = 86_400_000;
const MIN_MS = 60_000;

function dayOfYearUTC(instantMs: number): number {
  const d = new Date(instantMs);
  const start = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((instantMs - start) / DAY_MS) + 1;
}

/** NOAA Solar Calculator 均時差（分鐘）；EoT = apparent − mean solar time。 */
export function equationOfTimeMinutes(instantMs: number): number {
  const d = new Date(instantMs);
  const hourUTC = (instantMs % DAY_MS) / 3_600_000;
  const gamma = (2 * Math.PI / 365) * (dayOfYearUTC(instantMs) - 1 + (hourUTC - 12) / 24);
  const eot = 229.18 * (
    0.000075 +
    0.001868 * Math.cos(gamma) -
    0.032077 * Math.sin(gamma) -
    0.014615 * Math.cos(2 * gamma) -
    0.040849 * Math.sin(2 * gamma)
  );
  // d only used to keep the formula anchored to UTC calendar day.
  void d;
  return eot;
}

export interface SolarClock {
  dayNumber: number;
  minutesOfDay: number;
  totalMinutes: number;
  correctionMinutes: number;
  date: { year: number; month: number; day: number };
  crossedDate: boolean;
}

export function isValidLongitude(longitude: number | undefined): longitude is number {
  return typeof longitude === 'number' && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

/** 以 UTC 為基準的太陽鐘面；dayNumber 為 Unix 紀元起算的日數。 */
export function solarClock(instantMs: number, longitude: number): SolarClock {
  const eot = equationOfTimeMinutes(instantMs);
  const correction = 4 * longitude + eot;
  const totalMinutes = instantMs / MIN_MS + correction;
  const dayNumber = Math.floor(totalMinutes / 1440);
  const minutesOfDay = totalMinutes - dayNumber * 1440;
  const utcDayNumber = Math.floor(instantMs / DAY_MS);
  const jdn = dayNumber + 2440588; // JDN of civil date at 00:00 UTC
  return {
    dayNumber,
    minutesOfDay,
    totalMinutes,
    correctionMinutes: correction,
    date: gregorianFromJDN(jdn),
    crossedDate: dayNumber !== utcDayNumber,
  };
}

/** 23:00 子初換日：回傳干支日所用的 Gregorian 日期。 */
export function pillarDateForClock(date: { year: number; month: number; day: number }, minutesOfDay: number) {
  if (minutesOfDay < 23 * 60) return date;
  const jd = julianFromDate(date) + 1;
  return gregorianFromJDN(jd);
}

function julianFromDate(date: { year: number; month: number; day: number }): number {
  const y = date.month <= 2 ? date.year - 1 : date.year;
  const m = date.month <= 2 ? date.month + 12 : date.month;
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  return Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + date.day + b - 1524;
}
