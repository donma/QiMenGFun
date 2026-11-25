/** 下一相關規則事件 = 時辰邊界、刻邊界、交節邊界中最早者。 */
import { termBoundariesForYear } from '../domain/calendar/solarTerms';
import { nextHourBoundaryMs } from '../domain/qimen/hourEngine';
import { nextKeBoundaryMs } from '../domain/qimen/keEngine';
import type { ChartInput } from '../domain/qimen/types';

export interface BoundaryEvent {
  instantMs: number;
  kind: 'hour' | 'ke' | 'term';
  label: string;
}

export function nextBoundary(input: ChartInput, instantMs: number): BoundaryEvent {
  const term = termBoundariesForYear(new Date(instantMs).getUTCFullYear())
    .find((b) => b.instantMs > instantMs);
  const candidates: BoundaryEvent[] = [
    { instantMs: nextHourBoundaryMs(instantMs, input), kind: 'hour', label: '時辰' },
    { instantMs: nextKeBoundaryMs(input, instantMs), kind: 'ke', label: '刻' },
  ];
  if (term) candidates.push({ instantMs: term.instantMs, kind: 'term', label: term.name });
  return candidates.reduce((a, b) => (b.instantMs < a.instantMs ? b : a));
}

/** 在 [start, end] 內以真實邊界逐段取樣，最多 limit 段。 */
export function segmentBoundaries(input: ChartInput, startMs: number, endMs: number, limit = 2000): number[] {
  const out = [startMs];
  let cur = startMs;
  while (cur < endMs && out.length < limit) {
    const next = nextBoundary(input, cur).instantMs;
    if (next <= cur) break;
    cur = next;
    out.push(cur);
  }
  if (out[out.length - 1]! < endMs) out.push(endMs);
  return out;
}
