import { useState } from 'react';
import { NinePalaceGrid } from '../components/NinePalaceGrid';
import { EVENT_PROFILES, type EventKind } from '../domain/analysis/eventProfiles';
import { analyzeYearLife, YEAR_LIFE_VERSION } from '../domain/analysis/yearLife';
import { UNSUPPORTED_RULES } from '../domain/analysis/rules';
import { PALACES } from '../domain/qimen/tables';
import type { Chart, PalaceId } from '../domain/qimen/types';
import type { Person } from '../storage/storage';
import { buildAIPrompt } from '../export/exporter';
import type { AnalysisResult } from '../domain/analysis/eventProfiles';

export interface AnalysisPanelProps {
  chart: Chart | null;
  keStatus: string;
  analysis: AnalysisResult | null;
  event: EventKind;
  onEvent: (e: EventKind) => void;
  person: Person | null;
  selected: PalaceId | null;
  onSelect: (id: PalaceId) => void;
  onToast: (msg: string) => void;
}

export function AnalysisPanel({ chart, keStatus, analysis, event, onEvent, person, selected, onSelect, onToast }: AnalysisPanelProps) {
  const [aiOpen, setAiOpen] = useState(false);
  const [includePrivate, setIncludePrivate] = useState(false);
  const yearLife = analyzeYearLife({
    date: person?.birthDate ?? null,
    time: person?.birthTime ?? null,
    timezone: person?.birthTimezone ?? 'Asia/Taipei',
  }, chart);

  const chartText = chart ? [
    `排盤方法：hour-zhuan-chaibu-v1；節氣 ${chart.term}；${chart.dun === 'yang' ? '陽遁' : '陰遁'}${chart.ju}局`,
    `四柱：${chart.pillars.year} ${chart.pillars.month} ${chart.pillars.day} ${chart.pillars.hour}`,
    `符頭 ${chart.fuTou}；旬首 ${chart.xunHead}；值符 ${chart.dutyStar}；值使 ${chart.dutyDoor}`,
    ...chart.palaces.map((p) => `${PALACES.find((x) => x.id === p.id)?.short}：地盤 ${p.earthStems.join('')}、天盤 ${p.heavenStems.join('') || '—'}、星 ${p.stars.join('') || '—'}、門 ${p.door ?? '—'}、神 ${p.deity ?? '—'}、標記 ${p.markers.join('') || '—'}`),
    `有效區間：${new Date(chart.validFromMs).toISOString()} – ${new Date(chart.validUntilMs).toISOString()}`,
    `刻家：${keStatus}`,
  ].join('\n') : '尚無盤局資料';

  const prompt = buildAIPrompt(chartText, EVENT_PROFILES.find((e) => e.id === event)?.label ?? event, includePrivate,
    person ? `人物：${person.name}／生日 ${person.birthDate ?? '未知'}` : '');

  return (
    <div className="panel-scroll">
      <section className="panel-section glass">
        <h2>九宮盤與事件</h2>
        <div className="event-row" role="tablist" aria-label="事件類別">
          {EVENT_PROFILES.map((p) => (
            <button key={p.id} role="tab" aria-selected={event === p.id} className={`event-pill ${event === p.id ? 'on' : ''}`} onClick={() => onEvent(p.id)}>{p.label}</button>
          ))}
        </div>
        <p className="hint">{analysis?.note}</p>
        <NinePalaceGrid chart={chart} assessment={analysis} selected={selected} onSelect={onSelect} />
      </section>

      <section className="panel-section glass">
        <h2>時家／刻家對照</h2>
        <div className="compare-grid">
          <div><b>時家</b><span>{chart ? `${chart.term} · ${chart.dun === 'yang' ? '陽遁' : '陰遁'}${chart.ju}局` : '—'}</span></div>
          <div className="ke-box"><b>刻家</b><span className="unverified">刻家規則尚待驗證</span></div>
        </div>
        <p className="hint">双盤共振僅在同方位、同事件、兩盤皆 favorable 時標交集；任一 unknown 不推共振。此為產品自訂交集，非傳統定律，不稱能量加倍。</p>
      </section>

      <section className="panel-section glass">
        <h2>年命（選用）</h2>
        {yearLife.status === 'unavailable' || yearLife.status === 'uncertain'
          ? <p className="hint">{yearLife.reason}</p>
          : <>
            <p className="hint">{yearLife.yearGanzhi} · {yearLife.reason} 版本 {YEAR_LIFE_VERSION}</p>
            {yearLife.candidates.map((c, i) => (
              <div className="candidate" key={i}>{PALACES.find((p) => p.id === c.palaceId)?.short} · {c.layer}：{c.reason}</div>
            ))}
          </>}
        <p className="hint">不計算完整八字、不判喜忌；切換人物不改變基礎盤。</p>
      </section>

      <section className="panel-section glass">
        <h2>規則依據與限制</h2>
        <p className="hint">已啟用：八門、九星、八神、旬空、驛馬與事件取用神象意（傳統文化參考，非預測保證）。</p>
        <ul className="unsupported-list">
          {UNSUPPORTED_RULES.map((r) => <li key={r.id}>{r.id}：{r.reason}</li>)}
        </ul>
      </section>

      <section className="panel-section glass">
        <h2>複製 AI 解盤資料</h2>
        <p className="hint">先預覽完整盤面與方法版本；預設排除姓名、精確位置及生日。不會自動送出。</p>
        <label className="checkline"><input type="checkbox" checked={includePrivate} onChange={(e) => setIncludePrivate(e.target.checked)} /> 加入人物名稱與生日（自願）</label>
        <button className="btn" onClick={() => setAiOpen(!aiOpen)}>{aiOpen ? '收起預覽' : '預覽 Prompt'}</button>
        {aiOpen && (
          <>
            <pre className="prompt-preview">{prompt}</pre>
            <button className="btn primary" onClick={async () => {
              try { await navigator.clipboard.writeText(prompt); onToast('已複製到剪貼簿，未自動送出'); }
              catch { onToast('複製失敗，請手動選取'); }
            }}>複製到剪貼簿</button>
          </>
        )}
      </section>
    </div>
  );
}
