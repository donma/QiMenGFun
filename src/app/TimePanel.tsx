import { useEffect, useMemo, useRef, useState } from 'react';
import type { TimeState } from '../time/TimeController';
import { segmentBoundaries } from '../time/boundaryScheduler';
import { HOUR_PROFILE_ID, computeHourChart } from '../domain/qimen/hourEngine';
import { analyzeChart, EVENT_PROFILES, type EventKind } from '../domain/analysis/eventProfiles';
import { civilParts, resolveCivilInput, formatOffset } from '../domain/calendar/timezone';
import { PALACES } from '../domain/qimen/tables';
import type { Chart } from '../domain/qimen/types';
import { TONE_CLASS } from '../styles/tone';

export interface TimePanelProps {
  time: TimeState;
  onSetInstant: (ms: number) => void;
  onSetBasis: (basis: 'civil' | 'apparent-solar') => void;
  onSetLongitude: (lon: number | null) => void;
  onRequestGps: () => void;
  gpsStatus: string;
  chart: Chart | null;
  event: EventKind;
  onToast: (msg: string) => void;
}

export function TimePanel({ time, onSetInstant, onSetBasis, onSetLongitude, onRequestGps, gpsStatus, chart, event, onToast }: TimePanelProps) {
  const c = civilParts(time.instantMs, time.timezone);
  const [date, setDate] = useState(`${c.year}-${String(c.month).padStart(2, '0')}-${String(c.day).padStart(2, '0')}`);
  const [clock, setClock] = useState(`${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}`);
  const [lonInput, setLonInput] = useState(time.longitude === null ? '' : String(time.longitude));
  const [scanDays, setScanDays] = useState(1);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<Array<{ palaceId: number; score: number; count: number }>>([]);
  const cancelRef = useRef(false);

  useEffect(() => {
    const p = civilParts(time.instantMs, time.timezone);
    setDate(`${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`);
    setClock(`${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`);
  }, [time.instantMs, time.timezone]);

  const heat = useMemo(() => {
    const cells: Array<{ timeMs: number; favors: Map<number, string> }> = [];
    const start = Math.floor(time.instantMs / (10 * 60_000)) * 10 * 60_000;
    for (let i = 0; i < 12; i += 1) {
      const t = start + i * 10 * 60_000;
      const r = computeHourChart({ instantMs: t, timezone: time.timezone, basis: time.basis, longitude: time.longitude ?? undefined, profileId: HOUR_PROFILE_ID });
      const favors = new Map<number, string>();
      if (r.status === 'ok') analyzeChart(r.chart, event).directions.forEach((d) => favors.set(d.palaceId, d.favorability));
      cells.push({ timeMs: t, favors });
    }
    return cells;
  }, [time.instantMs, time.timezone, time.basis, time.longitude, event]);

  const applyCivil = () => {
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = clock.split(':').map(Number);
    if (!y || !m || !d || hh === undefined || mm === undefined) { onToast('日期或時間格式無效'); return; }
    const res = resolveCivilInput({ year: y, month: m, day: d, hour: hh, minute: mm, second: 0 }, time.timezone,
      civilParts(time.instantMs, time.timezone).offsetMinutes);
    if (res.status === 'ambiguous') {
      const choice = window.confirm(`此時間在 ${time.timezone} 有兩個 possible offset（${res.options.map((o) => formatOffset(o.offsetMinutes)).join(' / ')}）。請選「確定」使用較早者，或「取消」使用較晚者。`);
      onSetInstant(res.options[choice ? 0 : 1]!.instantMs);
    } else if (res.status === 'nonexistent') onToast(res.reason);
    else onSetInstant(res.instantMs);
  };

  const runScan = async () => {
    cancelRef.current = false;
    setScanning(true);
    setScanResult([]);
    const start = Date.parse(`${date}T00:00:00Z`);
    const end = start + scanDays * 86_400_000;
    const input = { instantMs: start, timezone: time.timezone, basis: time.basis, longitude: time.longitude ?? undefined, profileId: HOUR_PROFILE_ID };
    const bounds = segmentBoundaries(input, start, end, 600);
    const totals = new Map<number, { score: number; count: number }>();
    for (let i = 0; i < bounds.length - 1; i += 1) {
      if (cancelRef.current) break;
      const t = bounds[i]! + 1000;
      const r = computeHourChart({ ...input, instantMs: t });
      if (r.status === 'ok') {
        for (const d of analyzeChart(r.chart, event).directions) {
          const cur = totals.get(d.palaceId) ?? { score: 0, count: 0 };
          cur.score += d.favorability === 'favorable' ? 1 : d.favorability === 'caution' ? -1 : 0;
          cur.count += 1;
          totals.set(d.palaceId, cur);
        }
      }
      if (i % 40 === 0) await new Promise((resolve) => setTimeout(resolve, 0));
    }
    if (!cancelRef.current) {
      setScanResult([...totals.entries()].map(([palaceId, v]) => ({ palaceId, ...v })).sort((a, b) => b.score - a.score));
      onToast(`已掃描 ${bounds.length - 1} 個時段（真實邊界逐段計算）`);
    }
    setScanning(false);
  };

  return (
    <div className="panel-scroll">
      <section className="panel-section glass">
        <h2>日期與時間</h2>
        <div className="form-row">
          <label>日期<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
          <label>時間<input type="time" value={clock} onChange={(e) => setClock(e.target.value)} /></label>
          <button className="btn" onClick={applyCivil}>套用</button>
        </div>
        <div className="hint">目前：{new Date(time.instantMs).toISOString()} · {formatOffset(c.offsetMinutes)} · 模式 {time.mode}</div>
        <div className="form-row">
          <label className="select-label">時間基準
            <select value={time.basis} onChange={(e) => onSetBasis(e.target.value as 'civil' | 'apparent-solar')}>
              <option value="civil">裝置當地標準鐘面</option>
              <option value="apparent-solar">真太陽時（需經度）</option>
            </select>
          </label>
        </div>
        {time.basis === 'apparent-solar' && (
          <>
            <div className="form-row">
              <label>經度（東正西負）<input type="number" min={-180} max={180} step="0.001" value={lonInput} placeholder="例如 121.565" onChange={(e) => setLonInput(e.target.value)} /></label>
              <button className="btn" onClick={() => { const v = Number(lonInput); if (Number.isFinite(v) && v >= -180 && v <= 180) onSetLongitude(v); else onToast('經度須在 -180..180'); }}>套用</button>
              <button className="btn" onClick={onRequestGps}>取得 GPS</button>
            </div>
            <div className="hint">{gpsStatus || 'GPS 僅在使用者要求時取得一次；拒絕時可手填經度。無效經度不宣稱真太陽時。'}</div>
          </>
        )}
      </section>

      <section className="panel-section glass">
        <h2>熱力圖（8 方 × 未來 2 小時）</h2>
        <p className="hint">目前盤局：{chart?.term ?? '—'} · {chart ? `${chart.dun === 'yang' ? '陽遁' : '陰遁'}${chart.ju}局` : '—'}</p>
        <div className="heatmap">
          <div className="heat-row heat-head"><span>方位</span>{heat.map((h) => <span key={h.timeMs}>{new Date(h.timeMs).toLocaleTimeString('zh-Hant', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>)}</div>
          {PALACES.filter((p) => p.id !== 5).map((p) => (
            <div className="heat-row" key={p.id}>
              <button className="heat-name" onClick={() => onSetInstant(heat[0]!.timeMs)}>{p.short}</button>
              {heat.map((h) => {
                const tone = h.favors.get(p.id) ?? 'unknown';
                return <button key={h.timeMs} className={`heat-cell ${TONE_CLASS[tone as 'favorable']}`} onClick={() => onSetInstant(h.timeMs)} aria-label={`${p.short} ${new Date(h.timeMs).toLocaleTimeString('zh-Hant')} ${tone}`} />;
              })}
            </div>
          ))}
        </div>
        <p className="hint">格子切換到對應時刻；熱力圖僅是由已驗證時家盤與規則推導的彙總，不表示物理能量。</p>
      </section>

      <section className="panel-section glass">
        <h2>擇時掃描</h2>
        <div className="form-row">
          <label>範圍
            <select value={scanDays} onChange={(e) => setScanDays(Number(e.target.value))}>
              <option value={1}>今日</option><option value={2}>今日＋明日</option><option value={7}>7 日</option><option value={31}>31 日（自訂上限）</option>
            </select>
          </label>
          <button className="btn primary" onClick={runScan} disabled={scanning}>{scanning ? '計算中…' : '開始掃描'}</button>
          {scanning && <button className="btn" onClick={() => { cancelRef.current = true; }}>取消</button>}
        </div>
        <p className="hint">從 {date} 起，以真實節氣／時辰／刻邊界逐段計算，合併相同分析結果；分批处理且可取消。分數為規則計數，不是機率。</p>
        <div className="scan-results">
          {scanResult.map((r) => (
            <div className="scan-row" key={r.palaceId}>
              <span>{PALACES.find((p) => p.id === r.palaceId)?.short}</span>
              <span className={r.score > 0 ? 'good' : r.score < 0 ? 'bad' : ''}>{r.score > 0 ? '+' : ''}{r.score}</span>
              <small>{r.count} 段</small>
            </div>
          ))}
        </div>
        <p className="hint">事件：{EVENT_PROFILES.find((e) => e.id === event)?.label}；時區 {time.timezone}。不將相機朝向誤認為出行路線。</p>
      </section>
    </div>
  );
}
