import { useState } from 'react';
import { NinePalaceGrid } from '../components/NinePalaceGrid';
import { EVENT_PROFILES, type EventKind, type AnalysisResult } from '../domain/analysis/eventProfiles';
import { analyzeYearLife } from '../domain/analysis/yearLife';
import { UNSUPPORTED_RULES } from '../domain/analysis/rules';
import { PALACES } from '../domain/qimen/tables';
import type { Chart, PalaceId } from '../domain/qimen/types';
import type { Person } from '../storage/storage';
import { buildAIPrompt } from '../export/exporter';

export interface AnalysisPanelProps {
  chart: Chart | null;
  analysis: AnalysisResult | null;
  event: EventKind;
  onEvent: (e: EventKind) => void;
  person: Person | null;
  selected: PalaceId | null;
  onSelect: (id: PalaceId) => void;
  onToast: (msg: string) => void;
}

export function AnalysisPanel({ chart, analysis, event, onEvent, person, selected, onSelect, onToast }: AnalysisPanelProps) {
  const [aiOpen, setAiOpen] = useState(false);
  const [includePrivate, setIncludePrivate] = useState(false);
  const yearLife = person ? analyzeYearLife({
    date: person.birthDate, time: person.birthTime, timezone: person.birthTimezone ?? 'Asia/Taipei',
  }, chart) : null;

  const chartText = chart ? [
    `排盤方法：hour-zhuan-chaibu-v1；節氣 ${chart.term}；${chart.dun === 'yang' ? '陽遁' : '陰遁'}${chart.ju}局`,
    `四柱：${chart.pillars.year} ${chart.pillars.month} ${chart.pillars.day} ${chart.pillars.hour}`,
    `符頭 ${chart.fuTou}；旬首 ${chart.xunHead}；值符 ${chart.dutyStar}；值使 ${chart.dutyDoor}`,
    ...chart.palaces.map((p) => `${PALACES.find((x) => x.id === p.id)?.short}：地盤 ${p.earthStems.join('')}、天盤 ${p.heavenStems.join('') || '—'}、星 ${p.stars.join('') || '—'}、門 ${p.door ?? '—'}、神 ${p.deity ?? '—'}、標記 ${p.markers.join('') || '—'}`),
    `有效區間：${new Date(chart.validFromMs).toISOString()} – ${new Date(chart.validUntilMs).toISOString()}`,
    '刻家：規則尚待驗證，未提供',
  ].join('\n') : '尚無盤局資料';
  const prompt = buildAIPrompt(chartText, EVENT_PROFILES.find((e) => e.id === event)?.label ?? event, includePrivate,
    person ? `人物：${person.name}／生日 ${person.birthDate ?? '未知'}` : '');

  return (
    <div className="panel-scroll">
      <section className="panel-section glass">
        <h2>九宮盤</h2>
        <div className="event-row" role="tablist" aria-label="事件類別">
          {EVENT_PROFILES.map((p) => (
            <button key={p.id} role="tab" aria-selected={event === p.id} className={`event-pill ${event === p.id ? 'on' : ''}`} onClick={() => onEvent(p.id)}>{p.label}</button>
          ))}
        </div>
        <p className="hint">{analysis?.note} 點任一格可回羅盤查看。</p>
        <NinePalaceGrid chart={chart} assessment={analysis} selected={selected} onSelect={onSelect} />
      </section>

      <section className="panel-section glass">
        <h2>年命</h2>
        {!person && <p className="hint">到「工具」新增人物並填入生日，就能看年命落在哪一宮。不新增也不影響其他功能。</p>}
        {yearLife && (yearLife.status === 'ok'
          ? <>
            <p className="hint">{person?.name}：{yearLife.yearGanzhi} 年。以下是年干在此盤的位置。</p>
            {yearLife.candidates.map((c, i) => (
              <div className="candidate" key={i}>{PALACES.find((p) => p.id === c.palaceId)?.short} · {c.layer}：{c.reason}</div>
            ))}
          </>
          : <p className="hint">{yearLife.reason}</p>)}
      </section>

      <section className="panel-section glass">
        <details className="more">
          <summary>複製給 AI 解讀</summary>
          <p className="hint">先預覽內容再複製，不會自動送出。預設不含姓名與生日。</p>
          <label className="checkline"><input type="checkbox" checked={includePrivate} onChange={(e) => setIncludePrivate(e.target.checked)} /> 加入人物名稱與生日</label>
          <button className="btn" onClick={() => setAiOpen(!aiOpen)}>{aiOpen ? '收起預覽' : '預覽內容'}</button>
          {aiOpen && (
            <>
              <pre className="prompt-preview">{prompt}</pre>
              <button className="btn primary" onClick={async () => {
                try { await navigator.clipboard.writeText(prompt); onToast('已複製，未自動送出'); }
                catch { onToast('複製失敗，請手動選取'); }
              }}>複製到剪貼簿</button>
            </>
          )}
        </details>
      </section>

      <section className="panel-section glass">
        <details className="more">
          <summary>方法與限制</summary>
          <p className="hint">時家轉盤拆補（中五寄坤、子初換日）。判斷只用八門、九星、八神、旬空、驛馬與事件取用神的傳統象意，是文化參考，不是預測。</p>
          <p className="hint"><b>刻家規則尚待驗證</b>，目前不提供刻盤與雙盤推薦。</p>
          <ul className="unsupported-list">
            {UNSUPPORTED_RULES.map((r) => <li key={r.id}>{r.reason}</li>)}
          </ul>
        </details>
      </section>
    </div>
  );
}
