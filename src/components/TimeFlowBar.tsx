import { useCallback, useRef } from 'react';
import type { TimeState } from '../time/TimeController';
import { SPEEDS } from '../time/TimeController';
import { civilParts } from '../domain/calendar/timezone';

export interface TimeFlowBarProps {
  state: TimeState;
  onSeek: (instantMs: number) => void;
  onPlay: () => void;
  onNow: () => void;
  onSpeed: (speed: TimeState['speed']) => void;
  onDirection: (dir: 1 | -1) => void;
}

const WINDOW_MS = 60 * 60_000;

export function TimeFlowBar({ state, onSeek, onPlay, onNow, onSpeed, onDirection }: TimeFlowBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const seekFromX = useCallback((clientX: number) => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    onSeek(state.instantMs - WINDOW_MS / 2 + ratio * WINDOW_MS);
  }, [onSeek, state.instantMs]);

  const from = state.instantMs - WINDOW_MS / 2;
  const ticks = Array.from({ length: 37 }, (_, i) => {
    const t = from + i * 2 * 60_000;
    const c = civilParts(t, state.timezone);
    const label = i % 10 === 0 ? `${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}` : '';
    return { i, label, major: i % 5 === 0 };
  });
  const playhead = Math.min(100, Math.max(0, 50));

  return (
    <div className="timebar glass">
      <button className="play-btn" onClick={onPlay} aria-label={state.mode === 'playing' ? '暫停' : '播放'}>
        {state.mode === 'playing' ? '❚❚' : '▶'}
      </button>
      <div
        className="time-track"
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="時間軸"
        aria-valuemin={from}
        aria-valuemax={from + WINDOW_MS}
        aria-valuenow={state.instantMs}
        onPointerDown={(e) => { dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); seekFromX(e.clientX); }}
        onPointerMove={(e) => { if (dragging.current) seekFromX(e.clientX); }}
        onPointerUp={(e) => { dragging.current = false; e.currentTarget.releasePointerCapture(e.pointerId); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') { e.preventDefault(); onSeek(state.instantMs - 60_000); }
          if (e.key === 'ArrowRight') { e.preventDefault(); onSeek(state.instantMs + 60_000); }
        }}
      >
        <div className="time-line" />
        {ticks.map((t) => <div key={t.i} className={`tick ${t.major ? 'major' : ''}`} style={{ left: `${(t.i / 36) * 100}%` }} />)}
        {ticks.filter((t) => t.label).map((t) => (
          <span key={`l${t.i}`} className="tick-label" style={{ left: `${(t.i / 36) * 100}%` }}>{t.label}</span>
        ))}
        <div className="playhead" style={{ left: `${playhead}%` }} />
      </div>
      <div className="time-controls">
        <button className={`mini-btn ${state.direction === -1 ? 'on' : ''}`} onClick={() => onDirection(state.direction === 1 ? -1 : 1)} aria-label="切換方向">{state.direction === 1 ? '→' : '←'}</button>
        <button className="mini-btn speed" onClick={() => {
          const i = SPEEDS.indexOf(state.speed);
          onSpeed(SPEEDS[(i + 1) % SPEEDS.length]!);
        }} aria-label="切換速度">{state.speed}×</button>
        <button className={`now-btn ${state.mode === 'live' ? 'on' : ''}`} onClick={onNow}>NOW</button>
      </div>
    </div>
  );
}
