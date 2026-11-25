/**
 * 十分鐘刻家 — 發布阻斷關卡。
 *
 * 現有候選（周道十分钟刻家，冬至／夏至分遁、174／936 序列）缺少
 * 完整可核對例盤與刻干支／局數映射，因此 **不提供正式排盤**。
 * production 一律回傳 unverified；dev fixture 僅供研發，不進正式盤、不進推薦。
 *
 * 時間索引（12 刻／時辰，10 分鐘）是純時間切分，可安全使用；
 * 它不代表刻干支或定局。
 */
import { civilParts } from '../calendar/timezone';
import { solarClock, isValidLongitude } from '../calendar/solarTime';
import type { ChartInput, ChartResult } from './types';

export const KE_PROFILE_ID = 'ke-unverified-v1';
export const KE_PROFILE_VERSION = '0.0.0-dev';

export interface KeTimeIndex {
  keIndex: number; // 0..11（該時辰的第 k 刻）
  startMs: number;
  endMs: number;
  branchStartMinutes: number;
}

function minutesFor(input: ChartInput, instantMs: number): number {
  if (input.basis === 'apparent-solar') {
    if (!isValidLongitude(input.longitude)) throw new Error('真太陽時需要有效經度。');
    return solarClock(instantMs, input.longitude).minutesOfDay;
  }
  const c = civilParts(instantMs, input.timezone);
  return c.hour * 60 + c.minute + c.second / 60;
}

/** 純時間索引：時辰起點 + 10k 分鐘。與刻干支／定局無關。 */
export function keTimeIndex(input: ChartInput, instantMs: number): KeTimeIndex {
  const minutes = minutesFor(input, instantMs);
  const branchIdx = Math.floor((((minutes + 60) % 1440 + 1440) % 1440) / 120);
  const branchStart = branchIdx * 120 - 60;
  const elapsed = ((minutes - branchStart) % 1440 + 1440) % 1440;
  const keIndex = Math.min(11, Math.floor(elapsed / 10));
  const deltaToStart = (branchStart + keIndex * 10) - minutes;
  return {
    keIndex,
    startMs: Math.round(instantMs + deltaToStart * 60_000),
    endMs: Math.round(instantMs + (deltaToStart + 10) * 60_000),
    branchStartMinutes: branchStart,
  };
}

/** 下一刻邊界 UTC 時刻（供計時調度）。 */
export function nextKeBoundaryMs(input: ChartInput, instantMs: number): number {
  return keTimeIndex(input, instantMs).endMs;
}

/** 正式排盤：一律阻斷。 */
export function computeKeChart(_input: ChartInput): ChartResult {
  return {
    status: 'unverified',
    reason: '刻家規則尚待驗證。十分鐘刻家存在多個不同體系；現有資料不足以核對刻干支、局數、值符值使與星門神，為避免示意資料冒充正式盤，刻盤暫不提供。時間軸的 12 刻索引仍可使用。',
  };
}
