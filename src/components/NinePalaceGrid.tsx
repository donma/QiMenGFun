import { GRID_SOUTH_UP, PALACES } from '../domain/qimen/tables';
import type { Chart, PalaceId } from '../domain/qimen/types';
import type { AnalysisResult } from '../domain/analysis/eventProfiles';
import { TONE_CLASS } from '../styles/tone';

export interface NinePalaceGridProps {
  chart: Chart | null;
  assessment?: AnalysisResult | null;
  selected?: PalaceId | null;
  onSelect?: (id: PalaceId) => void;
  compact?: boolean;
}

export function NinePalaceGrid({ chart, assessment, selected, onSelect, compact }: NinePalaceGridProps) {
  const favMap = new Map(assessment?.directions.map((d) => [d.palaceId, d.favorability]) ?? []);
  return (
    <div className={`nine-grid ${compact ? 'compact' : ''}`} aria-label="九宮盤（南上北下）">
      {GRID_SOUTH_UP.map((row, ri) => (
        <div className="nine-row" key={ri}>
          {row.map((id) => {
            const p = chart?.palaces.find((x) => x.id === id);
            const def = PALACES.find((x) => x.id === id)!;
            const fav = favMap.get(id) ?? 'unknown';
            return (
              <button
                type="button"
                key={id}
                className={`nine-cell ${TONE_CLASS[fav]} ${selected === id ? 'is-selected' : ''}`}
                onClick={() => onSelect?.(id)}
                aria-label={`${def.short} ${p?.door ?? ''}`}
              >
                <span className="nine-name">{def.short}</span>
                <span className="nine-main">{p?.door ?? '—'}</span>
                <span className="nine-star">{p?.stars[0] ?? ''}</span>
                <span className="nine-stems">{p?.heavenStems[0] ?? ''} / {p?.earthStems[0] ?? ''}</span>
              </button>
            );
          })}
        </div>
      ))}
      <div className="nine-caption">傳統方格：南上北下；实景方位：北 0°、東 90°</div>
    </div>
  );
}
