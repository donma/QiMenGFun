/**
 * 單一時間狀態。live / preview / playing 共用同一 instantMs；
 * 模擬時間以單調時鐘映射，不用 setInterval 累加，不排隊過時動畫。
 */
import type { TimeBasis } from '../domain/qimen/types';

export type TimeMode = 'live' | 'preview' | 'playing';
export type PlaybackSpeed = 1 | 10 | 60 | 600;

export interface TimeState {
  mode: TimeMode;
  instantMs: number;
  rangeStartMs: number;
  rangeEndMs: number;
  speed: PlaybackSpeed;
  direction: 1 | -1;
  basis: TimeBasis;
  timezone: string;
  longitude: number | undefined;
}

export interface TimeConfig {
  basis: TimeBasis;
  timezone: string;
  longitude?: number;
  wallNowMs: number;
  rangeDays?: number;
}

export class TimeController {
  private state: TimeState;
  private listeners = new Set<() => void>();
  private anchorPerfMs = 0;
  private anchorInstantMs = 0;
  private wallNowMs: number;

  constructor(config: TimeConfig) {
    this.wallNowMs = config.wallNowMs;
    const range = (config.rangeDays ?? 1) * 86_400_000;
    this.state = {
      mode: 'live',
      instantMs: config.wallNowMs,
      rangeStartMs: config.wallNowMs - range / 2,
      rangeEndMs: config.wallNowMs + range / 2,
      speed: 1,
      direction: 1,
      basis: config.basis,
      timezone: config.timezone,
      longitude: config.longitude,
    };
  }

  getSnapshot = (): TimeState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private emit(next: TimeState): void {
    this.state = next;
    this.listeners.forEach((l) => l());
  }

  /** 由 rAF 呼叫：perfMs 單調，wallNowMs 為真實時刻。 */
  tick(perfMs: number, wallNowMs: number): void {
    this.wallNowMs = wallNowMs;
    if (this.state.mode === 'live') {
      if (Math.abs(wallNowMs - this.state.instantMs) >= 500) {
        this.emit({ ...this.state, instantMs: wallNowMs });
      }
      return;
    }
    if (this.state.mode !== 'playing') return;
    const delta = (perfMs - this.anchorPerfMs) * this.state.speed * this.state.direction;
    let instant = this.anchorInstantMs + delta;
    if (instant >= this.state.rangeEndMs || instant <= this.state.rangeStartMs) {
      instant = Math.min(this.state.rangeEndMs, Math.max(this.state.rangeStartMs, instant));
      this.emit({ ...this.state, instantMs: instant, mode: 'preview' });
      return;
    }
    if (Math.abs(instant - this.state.instantMs) >= 250) this.emit({ ...this.state, instantMs: instant });
  }

  toLive(perfMs: number): void {
    this.anchorPerfMs = perfMs;
    this.emit({ ...this.state, mode: 'live', instantMs: this.wallNowMs });
  }

  setInstant(instantMs: number, perfMs: number): void {
    this.anchorPerfMs = perfMs;
    this.anchorInstantMs = instantMs;
    this.emit({ ...this.state, mode: 'preview', instantMs });
  }

  seekByMinutes(minutes: number, perfMs: number): void {
    this.setInstant(this.state.instantMs + minutes * 60_000, perfMs);
  }

  play(perfMs: number): void {
    if (this.state.mode === 'playing') {
      this.emit({ ...this.state, mode: 'preview' });
      return;
    }
    let instant = this.state.instantMs;
    if (instant <= this.state.rangeStartMs || instant >= this.state.rangeEndMs) {
      instant = this.state.direction === 1 ? this.state.rangeStartMs : this.state.rangeEndMs;
    }
    this.anchorPerfMs = perfMs;
    this.anchorInstantMs = instant;
    this.emit({ ...this.state, mode: 'playing', instantMs: instant });
  }

  pause(): void {
    if (this.state.mode === 'playing') this.emit({ ...this.state, mode: 'preview' });
  }

  setSpeed(speed: PlaybackSpeed, perfMs: number): void {
    this.anchorPerfMs = perfMs;
    this.anchorInstantMs = this.state.instantMs;
    this.emit({ ...this.state, speed });
  }

  setDirection(direction: 1 | -1, perfMs: number): void {
    this.anchorPerfMs = perfMs;
    this.anchorInstantMs = this.state.instantMs;
    this.emit({ ...this.state, direction });
  }

  setRange(rangeStartMs: number, rangeEndMs: number): void {
    this.emit({ ...this.state, rangeStartMs, rangeEndMs });
  }

  setTimeConfig(config: Partial<Pick<TimeConfig, 'basis' | 'timezone' | 'longitude'>>): void {
    this.emit({ ...this.state, ...config });
  }

  /** 背景返回／時區變更：重新以真實時間對齊 live，不補播動畫。 */
  resync(wallNowMs: number): void {
    this.wallNowMs = wallNowMs;
    if (this.state.mode === 'live') this.emit({ ...this.state, instantMs: wallNowMs });
  }
}

export const SPEEDS: readonly PlaybackSpeed[] = [1, 10, 60, 600];
