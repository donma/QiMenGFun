import { describe, expect, it } from 'vitest';
import { TimeController } from './TimeController';
import { nextBoundary } from './boundaryScheduler';
import { HOUR_PROFILE_ID } from '../domain/qimen/hourEngine';

const base = Date.parse('2026-01-05T08:00:00Z');

describe('TimeController', () => {
  it('live 模式跟隨真實時鐘', () => {
    const c = new TimeController({ basis: 'civil', timezone: 'Asia/Taipei', wallNowMs: base });
    c.tick(0, base + 1000);
    expect(c.getSnapshot().instantMs).toBe(base + 1000);
    expect(c.getSnapshot().mode).toBe('live');
  });

  it('preview 不隨時鐘變動；NOW 回 live', () => {
    const c = new TimeController({ basis: 'civil', timezone: 'Asia/Taipei', wallNowMs: base });
    c.setInstant(base - 3600_000, 0);
    c.tick(1000, base + 5000);
    expect(c.getSnapshot().instantMs).toBe(base - 3600_000);
    c.toLive(1000);
    expect(c.getSnapshot().mode).toBe('live');
    expect(c.getSnapshot().instantMs).toBe(base + 5000);
  });

  it('playing 用單調時鐘 × 速度映射，終點停止', () => {
    const c = new TimeController({ basis: 'civil', timezone: 'Asia/Taipei', wallNowMs: base, rangeDays: 1 });
    c.setInstant(base, 0);
    c.setSpeed(10, 1000);
    c.play(1000);
    c.tick(6000, base + 5000); // 5s × 10× = 50s
    expect(c.getSnapshot().instantMs).toBe(base + 50_000);
    c.tick(1000_000_000, base + 1000_000);
    expect(c.getSnapshot().mode).toBe('preview');
    expect(c.getSnapshot().instantMs).toBeLessThanOrEqual(c.getSnapshot().rangeEndMs);
  });

  it('背景恢復 resync 不補播', () => {
    const c = new TimeController({ basis: 'civil', timezone: 'Asia/Taipei', wallNowMs: base });
    c.resync(base + 60_000);
    expect(c.getSnapshot().instantMs).toBe(base + 60_000);
  });
});

describe('邊界調度', () => {
  it('下一事件取時辰／刻／交節最早者', () => {
    const input = { instantMs: base, timezone: 'Asia/Taipei', basis: 'civil' as const, profileId: HOUR_PROFILE_ID };
    const e = nextBoundary(input, Date.parse('2026-01-05T08:23:00Z'));
    expect(['hour', 'ke', 'term']).toContain(e.kind);
    expect(e.instantMs).toBeGreaterThan(Date.parse('2026-01-05T08:23:00Z'));
  });
});
