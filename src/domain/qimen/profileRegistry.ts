import { HOUR_PROFILE_ID, HOUR_PROFILE_VERSION, computeHourChart } from './hourEngine';
import { KE_PROFILE_ID, KE_PROFILE_VERSION, computeKeChart, keTimeIndex } from './keEngine';
import type { ChartInput, ChartResult } from './types';

export interface ProfileInfo {
  id: string;
  version: string;
  label: string;
  status: 'verified-anchor' | 'unverified' | 'research';
  note: string;
}

export const PROFILES: readonly ProfileInfo[] = [
  {
    id: HOUR_PROFILE_ID,
    version: HOUR_PROFILE_VERSION,
    label: '時家轉盤拆補',
    status: 'verified-anchor',
    note: '中五寄坤、子初換日、交節即改節氣；通過 2026-01-05 16:23/16:24 雙盤錨點。完整 36 fixture 關卡見驗收報告。',
  },
  {
    id: KE_PROFILE_ID,
    version: KE_PROFILE_VERSION,
    label: '十分鐘刻家（候選）',
    status: 'unverified',
    note: '周道十分钟候選缺少可核對例盤；正式排盤阻斷，僅提供 12 刻時間索引。',
  },
];

export function chartFor(input: ChartInput): ChartResult {
  return input.profileId === HOUR_PROFILE_ID ? computeHourChart(input) : computeKeChart(input);
}

export { HOUR_PROFILE_ID, KE_PROFILE_ID, keTimeIndex };
