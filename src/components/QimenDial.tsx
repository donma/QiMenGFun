import { memo, useMemo } from 'react';
import { DIRECTIONS, type DirectionDeg } from '../domain/compass/directions';
import type { Chart, Favorability, PalaceId } from '../domain/qimen/types';
import type { AnalysisResult } from '../domain/analysis/eventProfiles';

export interface QimenDialProps {
  chart: Chart | null;
  hasHeading: boolean;
  headingQuality?: 'valid' | 'uncertain' | 'unavailable' | 'manual';
  facing: DirectionDeg | null;
  selected: PalaceId | null;
  onSelect: (id: PalaceId) => void;
  assessment?: AnalysisResult | null;
  reducedMotion: boolean;
}

const C = 250;
/** 同心環半徑（viewBox 500）。每一環只放一類資料，避免疊字。 */
const R = {
  disc: 247, tickOut: 243, dirOut: 238, dirIn: 206,
  ring1In: 160, ring2In: 116, ring3In: 74, taiji: 56,
  dirText: 223, ring1: 181, ring2: 138, ring3: 95,
};

function pos(deg: number, r: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [C + r * Math.sin(rad), C - r * Math.cos(rad)];
}

function sector(r1: number, r2: number, from: number, to: number): string {
  const [x1, y1] = pos(from, r2);
  const [x2, y2] = pos(to, r2);
  const [x3, y3] = pos(to, r1);
  const [x4, y4] = pos(from, r1);
  return `M ${x1} ${y1} A ${r2} ${r2} 0 0 1 ${x2} ${y2} L ${x3} ${y3} A ${r1} ${r1} 0 0 0 ${x4} ${y4} Z`;
}

const DOOR_COLOR: Record<Favorability, string> = {
  favorable: '#7CFFE0', mixed: '#FFE6A8', caution: '#FF9AA8', unknown: '#EAF8FF',
};

const STARFIELD = Array.from({ length: 54 }, (_, i) => {
  const a = (i * 137.508) % 360;
  const rr = 80 + ((i * 53) % 150);
  const [x, y] = pos(a, rr);
  return { x, y, r: i % 9 === 0 ? 1.5 : 0.8, o: 0.18 + (i % 5) * 0.08 };
});

interface StackProps { deg: number; r: number; children: React.ReactNode }

/** 以螢幕垂直方向堆疊多行文字；.upright 依 CSS 變數 --rot 反向旋轉，文字永遠正立且不互相重疊。 */
function Stack({ deg, r, children }: StackProps) {
  const [x, y] = pos(deg, r);
  return (
    <g transform={`translate(${x} ${y})`} pointerEvents="none">
      <g className="upright" textAnchor="middle" dominantBaseline="central">{children}</g>
    </g>
  );
}

export const QimenDial = memo(function QimenDial({
  chart, hasHeading, headingQuality, facing, selected, onSelect, assessment, reducedMotion,
}: QimenDialProps) {
  const favors = useMemo(() => {
    const m = new Map<number, Favorability>();
    assessment?.directions.forEach((d) => m.set(d.palaceId, d.favorability));
    return m;
  }, [assessment]);
  const palaceById = useMemo(() => new Map(chart?.palaces.map((p) => [p.id, p]) ?? []), [chart]);

  return (
    <svg className={`dial ${reducedMotion ? 'still' : ''}`} viewBox="0 0 500 500" role="img" aria-label="奇門方位盤">
      <defs>
        <radialGradient id="dial-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0d3a63" stopOpacity=".78" />
          <stop offset="60%" stopColor="#06213f" stopOpacity=".7" />
          <stop offset="100%" stopColor="#03122a" stopOpacity=".6" />
        </radialGradient>
        <radialGradient id="core-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#bfe9ff" stopOpacity=".55" />
          <stop offset="100%" stopColor="#bfe9ff" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="good-fill" cx="50%" cy="50%" r="60%">
          <stop offset="0%" stopColor="#36EBC0" stopOpacity=".32" />
          <stop offset="100%" stopColor="#36EBC0" stopOpacity=".12" />
        </radialGradient>
      </defs>

      <circle cx={C} cy={C} r={R.disc + 2} fill="none" stroke="#72D5FF" strokeWidth="6" opacity=".16" />
      <circle cx={C} cy={C} r={R.disc} fill="url(#dial-bg)" />
      {STARFIELD.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#E8F6FF" opacity={s.o} />)}

      <g className="dial-rot">
        {/* 外刻度：每 5° 一格，15° 與 45° 加長 */}
        {Array.from({ length: 72 }, (_, i) => {
          const deg = i * 5;
          const len = deg % 45 === 0 ? 9 : deg % 15 === 0 ? 6 : 3.5;
          const [x1, y1] = pos(deg, R.tickOut);
          const [x2, y2] = pos(deg, R.tickOut - len);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#D6F1FF" strokeWidth={deg % 45 === 0 ? 1.6 : 0.8} opacity={deg % 45 === 0 ? 0.95 : 0.6} />;
        })}

        {/* 方位字環 */}
        {DIRECTIONS.map((d) => {
          const cardinal = d.deg % 90 === 0;
          const label = cardinal ? { 0: '北', 90: '東', 180: '南', 270: '西' }[d.deg as 0 | 90 | 180 | 270] : { 45: '東北', 135: '東南', 225: '西南', 315: '西北' }[d.deg as 45 | 135 | 225 | 315];
          return (
            <Stack key={`dir-${d.deg}`} deg={d.deg} r={R.dirText}>
              <text className={cardinal ? 't-dir-main' : 't-dir-sub'} fill="#EAF8FF">{label}</text>
            </Stack>
          );
        })}

        {/* 扇區（可點） */}
        {DIRECTIONS.map((d) => {
          const fav = favors.get(d.palaceId) ?? 'unknown';
          const isSel = selected === d.palaceId;
          const isFacing = facing === d.deg;
          return (
            <path key={`sec-${d.deg}`} d={sector(R.ring3In, R.dirIn, d.deg - 22.5, d.deg + 22.5)}
              fill={fav === 'favorable' ? 'url(#good-fill)' : isSel ? 'rgba(114,213,255,.16)' : 'rgba(10,50,92,.22)'}
              stroke={isSel ? '#7CFFE0' : isFacing ? '#FFFFFF' : 'none'}
              strokeWidth={isSel ? 2.6 : 2}
              className="dial-sector" role="button" tabIndex={0}
              aria-label={`${d.short} ${palaceById.get(d.palaceId)?.door ?? ''}`}
              onClick={() => onSelect(d.palaceId)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(d.palaceId); } }} />
          );
        })}

        {/* 同心線與八方分隔線 */}
        {[R.disc, R.dirOut, R.dirIn, R.ring1In, R.ring2In, R.ring3In].map((r, i) => (
          <circle key={r} cx={C} cy={C} r={r} fill="none" stroke="#CFEFFF" strokeWidth={i === 0 ? 2 : 1.1} opacity={i === 0 ? 0.95 : 0.7} />
        ))}
        <circle cx={C} cy={C} r={R.disc - 5} fill="none" stroke="#CFEFFF" strokeWidth=".6" opacity=".4" />
        {DIRECTIONS.map((d) => {
          const [x1, y1] = pos(d.deg + 22.5, R.ring3In);
          const [x2, y2] = pos(d.deg + 22.5, R.dirOut);
          return <line key={`div-${d.deg}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#CFEFFF" strokeWidth="1" opacity=".6" />;
        })}

        {/* 宮名＋八門 */}
        {DIRECTIONS.map((d) => {
          const p = palaceById.get(d.palaceId);
          const fav = favors.get(d.palaceId) ?? 'unknown';
          return (
            <Stack key={`r1-${d.deg}`} deg={d.deg} r={R.ring1}>
              <text y={-12} className="t-name" fill="#BFE6FF">{d.short}</text>
              <text y={11} className="t-door" fill={DOOR_COLOR[fav]}>{p?.door ?? '—'}</text>
            </Stack>
          );
        })}

        {/* 九星＋八神（含天禽寄坤） */}
        {DIRECTIONS.map((d) => {
          const p = palaceById.get(d.palaceId);
          const stars = p?.stars ?? [];
          return (
            <Stack key={`r2-${d.deg}`} deg={d.deg} r={R.ring2}>
              {stars.length > 1 ? (
                <>
                  <text y={-15} className="t-star" fill="#D4ECFF">{stars[0]}</text>
                  <text y={1} className="t-star-sub" fill="#B9DDF5">{stars[1]}</text>
                  <text y={16} className="t-deity" fill="#9FC4DD">{p?.deity ?? ''}</text>
                </>
              ) : (
                <>
                  <text y={-9} className="t-star" fill="#D4ECFF">{stars[0] ?? '—'}</text>
                  <text y={12} className="t-deity" fill="#9FC4DD">{p?.deity ?? ''}</text>
                </>
              )}
            </Stack>
          );
        })}

        {/* 天盤干（金）／地盤干（藍） */}
        {DIRECTIONS.map((d) => {
          const p = palaceById.get(d.palaceId);
          return (
            <Stack key={`r3-${d.deg}`} deg={d.deg} r={R.ring3}>
              <text y={-10} className="t-heaven" fill="#FFE29A">{p?.heavenStems.join('') || '—'}</text>
              <text y={11} className="t-earth" fill="#8FD3FF">{p?.earthStems.join('') ?? ''}</text>
            </Stack>
          );
        })}

        {/* 太極中宮 */}
        <g role="button" tabIndex={0} aria-label="中宮太極" className="taiji" onClick={() => onSelect(5)} onKeyDown={(e) => { if (e.key === 'Enter') onSelect(5); }}>
          <circle cx={C} cy={C} r={R.ring3In - 1} fill="url(#core-glow)" />
          <circle cx={C} cy={C} r={R.taiji + 7} fill="none" stroke="#CFEFFF" strokeWidth="1.2" opacity=".85" />
          <circle cx={C} cy={C} r={R.taiji + 3} fill="none" stroke="#CFEFFF" strokeWidth=".6" opacity=".5" />
          <g className={reducedMotion ? '' : 'taiji-spin'}>
            <circle cx={C} cy={C} r={R.taiji} fill="#041a33" />
            <path d={`M ${C} ${C - R.taiji} A ${R.taiji} ${R.taiji} 0 0 1 ${C} ${C + R.taiji} A ${R.taiji / 2} ${R.taiji / 2} 0 0 1 ${C} ${C} A ${R.taiji / 2} ${R.taiji / 2} 0 0 0 ${C} ${C - R.taiji} Z`} fill="#F4FBFF" />
            <circle cx={C} cy={C - R.taiji / 2} r="11" fill="#041a33" />
            <circle cx={C} cy={C + R.taiji / 2} r="11" fill="#F4FBFF" />
            <circle cx={C} cy={C - R.taiji / 2} r="11" fill="none" stroke="#9FD9F5" strokeWidth="1.2" />
            <circle cx={C} cy={C + R.taiji / 2} r="11" fill="none" stroke="#04284a" strokeWidth="1.2" />
          </g>
        </g>
      </g>

      {/* 鏡頭朝向指標（固定在上方） */}
      <g pointerEvents="none">
        <path d={`M ${C} -8 L ${C - 9} 12 L ${C + 9} 12 Z`} fill="#36EBC0" />
        {hasHeading && headingQuality !== 'valid' && <text x={C} y={-14} textAnchor="middle" className="t-warn" fill="#FFE29A">方位待校正</text>}
      </g>
    </svg>
  );
});

