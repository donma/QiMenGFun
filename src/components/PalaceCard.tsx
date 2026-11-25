import { useEffect, useRef } from 'react';
import { DIRECTIONS, directionAt } from '../domain/compass/directions';
import { PALACES } from '../domain/qimen/tables';
import type { Chart, PalaceId } from '../domain/qimen/types';
import type { AnalysisResult, DirectionAssessment } from '../domain/analysis/eventProfiles';
import type { YearLifeResult } from '../domain/analysis/yearLife';
import { TONE_CLASS, TONE_LABEL } from '../styles/tone';

export interface PalaceCardProps {
  chart: Chart | null;
  palaceId: PalaceId;
  assessment: AnalysisResult | null;
  yearLife?: YearLifeResult | null;
  eventLabel: string;
  heading: number | null;
  expanded: boolean;
  onExpand: (value: boolean) => void;
  onClose: () => void;
  onSelect: (id: PalaceId) => void;
}

export function PalaceCard({ chart, palaceId, assessment, yearLife, eventLabel, heading, expanded, onExpand, onClose, onSelect }: PalaceCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const palace = chart?.palaces.find((p) => p.id === palaceId);
  const def = PALACES.find((p) => p.id === palaceId)!;
  const entry: DirectionAssessment | undefined = assessment?.directions.find((d) => d.palaceId === palaceId);
  const fav = entry?.favorability ?? 'unknown';
  const dirDeg = def.deg ?? 0;
  const currentDir = heading === null ? null : DIRECTIONS[Math.round(((heading % 360) + 360) % 360 / 45) % 8];

  useEffect(() => {
    if (!expanded) return;
    cardRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [expanded, onClose]);

  if (!palace) return null;
  const interval = `${new Date(chart!.validFromMs).toLocaleTimeString('zh-Hant', { hour: '2-digit', minute: '2-digit', hour12: false })}–${new Date(chart!.validUntilMs).toLocaleTimeString('zh-Hant', { hour: '2-digit', minute: '2-digit', hour12: false })}`;

  return (
    <div className={`palace-layer ${expanded ? 'is-sheet' : ''}`}>
      <div className="palace-backdrop" onClick={() => (expanded ? onExpand(false) : onClose())} />
      <div className={`palace-card glass ${TONE_CLASS[fav]}`} ref={cardRef} tabIndex={-1} role="dialog" aria-label={`${def.short}詳情`}>
        <div className="palace-head">
          <div>
            <div className="palace-title">{def.short}<span className="palace-deg">{def.deg === null ? '中宮（無實景方位）' : `${def.deg}° ${def.name}`}</span></div>
            <div className="palace-sub">事件：{eventLabel} · {interval}</div>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="關閉">✕</button>
        </div>
        <div className="palace-tags">
          <span className="tag tag-door">{palace.door ?? '無門'}</span>
          {palace.stars.map((s) => <span className="tag tag-star" key={s}>{s}</span>)}
          {palace.deity && <span className="tag tag-deity">{palace.deity}</span>}
          {palace.markers.map((m) => <span className="tag tag-marker" key={m}>{m}</span>)}
        </div>
        <div className={`palace-verdict ${TONE_CLASS[fav]}`}>
          <b>{TONE_LABEL[fav]}</b>
          <span>{entry?.reasons.join('；') || (fav === 'unknown' ? '尚無足夠依據，不給吉凶判斷。' : '')}</span>
        </div>
        {expanded && (
          <div className="palace-detail">
            <div className="detail-grid">
              <div><span>地盤干</span><b>{palace.earthStems.join('、')}</b></div>
              <div><span>天盤干</span><b>{palace.heavenStems.join('、') || '—'}</b></div>
              <div><span>寄宮</span><b>{palace.hostedFrom.length ? palace.hostedFrom.map((id) => PALACES.find((p) => p.id === id)?.short).join('、') : '—'}</b></div>
              <div><span>宮五行</span><b>{def.element}</b></div>
              <div><span>值符</span><b>{chart!.dutyStar}</b></div>
              <div><span>值使</span><b>{chart!.dutyDoor}</b></div>
            </div>
            {yearLife?.status === 'ok' && (
              <div className="year-life">
                <b>年命 {yearLife.yearGanzhi}</b>
                {yearLife.candidates.filter((c) => c.palaceId === palaceId).map((c, i) => <div key={i}>{c.layer}：{c.reason}</div>)}
              </div>
            )}
            <div className="detail-note">方位僅供參考；選中方位 {directionAt(dirDeg).short} 與實際鏡頭朝向 {currentDir?.short ?? '未知'} 分別標示。此為傳統文化參考，非科學驗證的預測。</div>
            <div className="detail-nav">
              {[1, 8, 3, 4, 9, 2, 7, 6].map((id) => (
                <button key={id} className={`nav-pill ${id === palaceId ? 'on' : ''}`} onClick={() => onSelect(id as PalaceId)}>{PALACES.find((p) => p.id === id)?.short}</button>
              ))}
            </div>
          </div>
        )}
        <button className="expand-btn" onClick={() => onExpand(!expanded)} aria-expanded={expanded}>
          {expanded ? '收起詳情' : '展開底部詳細面板'} {expanded ? '⌄' : '⌃'}
        </button>
      </div>
    </div>
  );
}
