import { memo, useMemo } from 'react';
import { DIRECTIONS } from '../domain/compass/directions';
import { normalizeDeg } from '../domain/compass/heading';
import type { Chart, Favorability, PalaceId } from '../domain/qimen/types';
import type { AnalysisResult } from '../domain/analysis/eventProfiles';

export interface DialLayers {
  earth: boolean;
  heaven: boolean;
  stars: boolean;
  doors: boolean;
  deities: boolean;
  outer: boolean;
  light: boolean;
  ke: boolean;
}

export interface QimenDialProps {
  chart: Chart | null;
  heading: number | null;
  headingQuality?: 'valid' | 'uncertain' | 'unavailable' | 'manual';
  selected: PalaceId | null;
  onSelect: (id: PalaceId) => void;
  assessment?: AnalysisResult | null;
  lightTheme: 'focus' | 'all' | 'blue';
  layers: DialLayers;
  reducedMotion: boolean;
  dual?: boolean;
  demo?: boolean;
}

const C = 250;
const R = {
  tickOut: 247, tickIn: 234, dir: 222, outerBand: 220,
  palaceOut: 216, palaceIn: 170,
  stemBandOut: 164, stemBandIn: 96,
  deity: 148, star: 158, door: 176, name: 204,
  heaven: 140, earth: 104,
  taiji: 56, ke: 88,
};

function pos(deg: number, r: number): [number, number] {
  const rad = (deg * Math.PI) / 180;
  return [C + r * Math.sin(rad), C - r * Math.cos(rad)];
}

function annular(r1: number, r2: number, fromDeg: number, toDeg: number): string {
  const [x1, y1] = pos(fromDeg, r2);
  const [x2, y2] = pos(toDeg, r2);
  const [x3, y3] = pos(toDeg, r1);
  const [x4, y4] = pos(fromDeg, r1);
  const large = toDeg - fromDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r2} ${r2} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${r1} ${r1} 0 ${large} 0 ${x4} ${y4} Z`;
}

function tp(deg: number, r: number, rotation: number | null, className: string) {
  const [x, y] = pos(deg, r);
  return { x, y, transform: rotation === null ? undefined : `rotate(${-rotation} ${x} ${y})`, textAnchor: 'middle' as const, dominantBaseline: 'central' as const, className };
}

const TONE_COLOR: Record<Favorability, string> = {
  favorable: '#36EBC0', mixed: '#F2C879', caution: '#DD6675', unknown: '#7293B0',
};

/** 確定性星點背景（純裝飾）。 */
const STARS = Array.from({ length: 46 }, (_, i) => {
  const a = (i * 137.508) % 360;
  const rr = 70 + ((i * 41) % 165);
  const [x, y] = pos(a, rr);
  return { x, y, r: i % 7 === 0 ? 1.6 : 0.9, o: 0.2 + (i % 5) * 0.1 };
});

export const QimenDial = memo(function QimenDial({
  chart, heading, headingQuality, selected, onSelect,
  assessment, lightTheme, layers, reducedMotion, dual, demo,
}: QimenDialProps) {
  const rotation = heading === null ? 0 : normalizeDeg(heading);
  const hasHeading = heading !== null && !demo;
  const rot = hasHeading ? `rotate(${-rotation} ${C} ${C})` : undefined;
  const favors = useMemo(() => {
    const m = new Map<number, Favorability>();
    assessment?.directions.forEach((d) => m.set(d.palaceId, d.favorability));
    return m;
  }, [assessment]);
  const palaceById = useMemo(() => new Map(chart?.palaces.map((p) => [p.id, p]) ?? []), [chart]);

  return (
    <svg className={`dial ${reducedMotion ? 'still' : ''}`} viewBox="0 0 500 500" role="img" aria-label="奇門方位全息盤">
      <defs>
        <radialGradient id="dial-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#0e3b5c" stopOpacity="0.92" />
          <stop offset="62%" stopColor="#071f36" stopOpacity="0.88" />
          <stop offset="100%" stopColor="#03101e" stopOpacity="0.78" />
        </radialGradient>
        <linearGradient id="ring-gradient" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#72D5FF" stopOpacity=".9" />
          <stop offset="50%" stopColor="#36EBC0" stopOpacity=".7" />
          <stop offset="100%" stopColor="#72D5FF" stopOpacity=".9" />
        </linearGradient>
      </defs>

      <circle cx={C} cy={C} r={248} fill="url(#dial-bg)" stroke="rgba(114,213,255,.55)" strokeWidth="1.2" />
      {STARS.map((s, i) => <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#D9F3FF" opacity={s.o} />)}

      <g transform={rot}>
        {/* 外圈細刻度與發光環 */}
        <circle cx={C} cy={C} r={R.outerBand} fill="none" stroke="url(#ring-gradient)" strokeWidth="1.4" opacity=".85" />
        <circle cx={C} cy={C} r={R.tickIn} fill="none" stroke="rgba(114,213,255,.5)" strokeWidth="1" />
        <circle cx={C} cy={C} r={R.tickOut} fill="none" stroke="rgba(114,213,255,.32)" strokeWidth="0.8" />
        {Array.from({ length: 180 }, (_, i) => {
          const deg = i * 2;
          const major = i % 15 === 0;
          const mid = i % 5 === 0;
          const [x1, y1] = pos(deg, R.tickOut);
          const [x2, y2] = pos(deg, major ? R.tickIn : mid ? R.tickIn + 4 : R.tickIn + 8);
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={major ? '#D9F3FF' : '#72D5FF'} strokeWidth={major ? 1.6 : 0.7} opacity={major ? 0.95 : 0.55} />;
        })}
        {Array.from({ length: 24 }, (_, i) => {
          const deg = i * 15;
          return <text key={i} {...tp(deg, 241, hasHeading ? rotation : null, 't-degree')} fill="rgba(217,243,255,.78)">{String(deg).padStart(3, '0')}</text>;
        })}

        {/* 八方位分隔線（貫穿多層） */}
        {DIRECTIONS.map((d) => {
          const [x1, y1] = pos(d.deg + 22.5, R.taiji + 4);
          const [x2, y2] = pos(d.deg + 22.5, R.outerBand);
          return <line key={`div-${d.deg}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(114,213,255,.32)" strokeWidth="1" />;
        })}

        {/* 宮位扇區 */}
        {DIRECTIONS.map((d) => {
          const p = palaceById.get(d.palaceId);
          const fav = favors.get(d.palaceId) ?? 'unknown';
          const isSelected = selected === d.palaceId;
          const glow = lightTheme !== 'blue' && fav === 'favorable';
          const color = lightTheme === 'blue' ? '#D9F3FF' : TONE_COLOR[fav];
          return (
            <g key={d.deg}>
              <path d={annular(R.palaceIn, R.palaceOut, d.deg - 22.3, d.deg + 22.3)}
                fill={glow ? 'rgba(54,235,192,.16)' : 'rgba(9,40,64,.58)'}
                stroke={isSelected ? '#36EBC0' : 'rgba(114,213,255,.5)'}
                strokeWidth={isSelected ? 2.6 : 1.1}
                className="dial-sector" role="button" tabIndex={0}
                aria-label={`${d.short}，${p?.door ?? '無門'}`}
                onClick={() => onSelect(d.palaceId)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(d.palaceId); } }} />
              {glow && <path d={annular(R.palaceIn, R.palaceOut, d.deg - 20, d.deg + 20)} fill="none" stroke="#36EBC0" strokeWidth="4" opacity=".28" className="breath" />}
              <text {...tp(d.deg, R.name, hasHeading ? rotation : null, 't-name')} fill={color}>{d.short}</text>
              {layers.doors && p?.door && <text {...tp(d.deg, R.door, hasHeading ? rotation : null, 't-door')} fill={color}>{p.door}</text>}
              {layers.stars && p?.stars[0] && <text {...tp(d.deg, R.star, hasHeading ? rotation : null, 't-star')} fill="#9FD9F5">{p.stars[0]}</text>}
              {layers.deities && p?.deity && <text {...tp(d.deg, R.deity, hasHeading ? rotation : null, 't-deity')} fill="rgba(217,243,255,.8)">{p.deity}</text>}
              <text {...tp(d.deg, R.dir, hasHeading ? rotation : null, 't-dir')} fill="#D9F3FF">{d.name}</text>
            </g>
          );
        })}

        {/* 天地盤環 */}
        <circle cx={C} cy={C} r={R.stemBandOut} fill="none" stroke="rgba(114,213,255,.38)" strokeWidth="1" />
        <circle cx={C} cy={C} r={R.stemBandIn} fill="none" stroke="rgba(114,213,255,.45)" strokeWidth="1.2" />
        {layers.heaven && DIRECTIONS.map((d) => {
          const p = palaceById.get(d.palaceId);
          return p?.heavenStems[0] ? <text key={`h${d.deg}`} {...tp(d.deg, R.heaven, hasHeading ? rotation : null, 't-heaven')}>{p.heavenStems[0]}</text> : null;
        })}
        {layers.earth && DIRECTIONS.map((d) => {
          const p = palaceById.get(d.palaceId);
          return p?.earthStems[0] ? <text key={`e${d.deg}`} {...tp(d.deg, R.earth, hasHeading ? rotation : null, 't-earth')}>{p.earthStems[0]}</text> : null;
        })}
        {layers.ke && dual && <circle cx={C} cy={C} r={R.ke} fill="none" stroke="rgba(242,200,121,.65)" strokeWidth="1.2" strokeDasharray="4 5" />}

        {/* 太極中宮 */}
        <g role="button" tabIndex={0} aria-label="中宮太極" onClick={() => onSelect(5)} onKeyDown={(e) => { if (e.key === 'Enter') onSelect(5); }}>
          <circle cx={C} cy={C} r={R.taiji} fill="#061a2c" stroke="rgba(114,213,255,.85)" strokeWidth="1.8" />
          <g className={reducedMotion ? '' : 'taiji-spin'}>
            <circle cx={C} cy={C} r="47" fill="#08233b" />
            <path d={`M ${C} ${C - 47} A 47 47 0 0 1 ${C} ${C + 47} A 23.5 23.5 0 0 1 ${C} ${C} A 23.5 23.5 0 0 0 ${C} ${C - 47} Z`} fill="#EAF9FF" />
            <circle cx={C} cy={C - 23.5} r="8.5" fill="#041323" />
            <circle cx={C} cy={C + 23.5} r="8.5" fill="#EAF9FF" />
          </g>
        </g>
      </g>

      {/* 鏡頭中心線 */}
      <g pointerEvents="none">
        <path d={`M ${C} 3 L ${C - 10} 26 L ${C + 10} 26 Z`} fill="#36EBC0" opacity=".95" />
        {hasHeading && headingQuality !== 'valid' && <text x={C} y={43} textAnchor="middle" className="t-warn" fill="#F2C879">方位待校正</text>}
      </g>
    </svg>
  );
});
