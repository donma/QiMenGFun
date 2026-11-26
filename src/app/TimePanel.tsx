import { useMemo, useState } from 'react';
import type { TimeState } from '../time/TimeController';
import { HOUR_PROFILE_ID, computeHourChart } from '../domain/qimen/hourEngine';
import { analyzeChart, EVENT_PROFILES, yongshenOf, type EventKind } from '../domain/analysis/eventProfiles';
import { civilParts, resolveCivilInput, formatOffset } from '../domain/calendar/timezone';
import { PALACES } from '../domain/qimen/tables';

export interface TimePanelProps {
  time: TimeState;
  event: EventKind;
  onEvent: (e: EventKind) => void;
  onSetInstant: (ms: number) => void;
  onNow: () => void;
  onJump: (ms: number) => void;
  onSetBasis: (basis: 'civil' | 'apparent-solar') => void;
  onSetLongitude: (lon: number | null) => void;
  onRequestGps: () => void;
  gpsStatus: string;
  onToast: (msg: string) => void;
}

interface Slot {
  startMs: number;
  endMs: number;
  branch: string;
  label: string;
  good: Array<{ id: number; text: string }>;
  caution: number;
}

const p2 = (n: number) => String(n).padStart(2, '0');
const hm = (ms: number, tz: string) => { const c = civilParts(ms, tz); return `${p2(c.hour)}:${p2(c.minute)}`; };

export function TimePanel({ time, event, onEvent, onSetInstant, onNow, onJump, onSetBasis, onSetLongitude, onRequestGps, gpsStatus, onToast }: TimePanelProps) {
  const c = civilParts(time.instantMs, time.timezone);
  const [date, setDate] = useState(`${c.year}-${p2(c.month)}-${p2(c.day)}`);
  const [clock, setClock] = useState(`${p2(c.hour)}:${p2(c.minute)}`);
  const [lonInput, setLonInput] = useState(time.longitude === undefined ? '' : String(time.longitude));
  const dateKey = `${c.year}-${c.month}-${c.day}`;

  const slots = useMemo<Slot[]>(() => {
    const out: Slot[] = [];
    for (let h = 0; h < 24; h += 2) {
      const r = resolveCivilInput({ year: c.year, month: c.month, day: c.day, hour: h, minute: 0, second: 0 }, time.timezone);
      const at = r.status === 'ok' ? r.instantMs : r.status === 'ambiguous' ? r.options[0]!.instantMs : null;
      if (at === null) continue;
      const res = computeHourChart({ instantMs: at, timezone: time.timezone, basis: time.basis, longitude: time.longitude, profileId: HOUR_PROFILE_ID });
      if (res.status !== 'ok') continue;
      const ch = res.chart;
      const a = analyzeChart(ch, event);
      const good = a.directions
        .filter((d) => d.favorability === 'favorable')
        .sort((x, y) => Number(y.yongshen) - Number(x.yongshen) || y.reasons.length - x.reasons.length)
        .slice(0, 3)
        .map((d) => {
          const def = PALACES.find((p) => p.id === d.palaceId)!;
          const pal = ch.palaces.find((p) => p.id === d.palaceId);
          return { id: d.palaceId, text: `${def.name}${def.deg === null ? '' : def.deg + '°'} ${yongshenOf(pal!, EVENT_PROFILES.find((e) => e.id === event)!).join('＋')}` };
        });
      out.push({
        startMs: ch.validFromMs, endMs: ch.validUntilMs, branch: ch.pillars.hour.slice(1),
        label: `${hm(ch.validFromMs, time.timezone)}–${hm(ch.validUntilMs, time.timezone)}`,
        good, caution: a.directions.filter((d) => d.favorability === 'caution').length,
      });
    }
    return out;
  // 以「日期」而非每秒時間為依賴，避免每秒重算 12 張盤
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateKey, time.timezone, time.basis, time.longitude, event]);

  const applyCivil = () => {
    const [y, m, d] = date.split('-').map(Number);
    const [hh, mm] = clock.split(':').map(Number);
    if (!y || !m || !d || hh === undefined || mm === undefined) { onToast('日期或時間格式無效'); return; }
    const res = resolveCivilInput({ year: y, month: m, day: d, hour: hh, minute: mm, second: 0 }, time.timezone, civilParts(time.instantMs, time.timezone).offsetMinutes);
    if (res.status === 'ambiguous') {
      const early = window.confirm(`此時間在 ${time.timezone} 出現兩次（${res.options.map((o) => formatOffset(o.offsetMinutes)).join(' / ')}）。按「確定」使用較早者，「取消」使用較晚者。`);
      onSetInstant(res.options[early ? 0 : 1]!.instantMs);
    } else if (res.status === 'nonexistent') onToast(res.reason);
    else { onSetInstant(res.instantMs); onToast('已切換到指定時間（預覽）'); }
  };

  const step = (ms: number) => onSetInstant(time.instantMs + ms);
  const label = EVENT_PROFILES.find((e) => e.id === event)?.label ?? '';

  return (
    <div className="panel-scroll">
      <section className="panel-section glass">
        <h2>查看其他時間</h2>
        <div className="now-line">
          <b className="num">{p2(c.hour)}:{p2(c.minute)}</b>
          <span>{c.year}/{c.month}/{c.day} · {formatOffset(c.offsetMinutes)}</span>
          <em className={time.mode === 'live' ? 'live' : 'preview'}>{time.mode === 'live' ? '現在' : '預覽中'}</em>
        </div>
        <div className="step-row">
          <button className="btn" onClick={() => step(-2 * 3600_000)}>−2 小時</button>
          <button className="btn" onClick={() => step(-20 * 60_000)}>−20 分</button>
          <button className="btn primary" onClick={onNow}>現在</button>
          <button className="btn" onClick={() => step(20 * 60_000)}>+20 分</button>
          <button className="btn" onClick={() => step(2 * 3600_000)}>+2 小時</button>
        </div>
        <details className="more">
          <summary>指定日期與時間</summary>
          <div className="form-row">
            <label>日期<input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
            <label>時間<input type="time" value={clock} onChange={(e) => setClock(e.target.value)} /></label>
            <button className="btn" onClick={applyCivil}>套用</button>
          </div>
        </details>
      </section>

      <section className="panel-section glass">
        <h2>今日吉時吉方</h2>
        <div className="event-row" role="tablist" aria-label="事件類別">
          {EVENT_PROFILES.map((p) => (
            <button key={p.id} role="tab" aria-selected={event === p.id} className={`event-pill ${event === p.id ? 'on' : ''}`} onClick={() => onEvent(p.id)}>{p.label}</button>
          ))}
        </div>
        <p className="hint">依「{label}」列出今天每個時辰有利的方位。點任一列，羅盤會切到那個時段。</p>
        <div className="slot-list">
          {slots.map((s) => {
            const now = time.instantMs >= s.startMs && time.instantMs < s.endMs;
            return (
              <button key={s.startMs} className={`slot ${now ? 'now' : ''}`} onClick={() => onJump(s.startMs + 60_000)}>
                <span className="slot-time"><b>{s.branch}時</b><small className="num">{s.label}</small></span>
                <span className="slot-good">
                  {s.good.length === 0 ? <em className="muted">無明確吉方</em> : s.good.map((g) => <i className="chip-mini" key={g.id}>{g.text}</i>)}
                </span>
                {now && <span className="slot-now">目前</span>}
              </button>
            );
          })}
        </div>
        <p className="hint">這是依傳統象意規則整理的參考，不是預測；沒有標示的時段代表沒有足夠依據，不代表不好。</p>
      </section>

      <section className="panel-section glass">
        <details className="more">
          <summary>進階：時間基準（真太陽時）</summary>
          <label className="select-label">時間基準
            <select value={time.basis} onChange={(e) => onSetBasis(e.target.value as 'civil' | 'apparent-solar')}>
              <option value="civil">裝置當地標準鐘面（預設）</option>
              <option value="apparent-solar">真太陽時（需經度）</option>
            </select>
          </label>
          {time.basis === 'apparent-solar' && (
            <>
              <div className="form-row">
                <label>經度（東正西負）<input type="number" min={-180} max={180} step="0.001" value={lonInput} placeholder="例如 121.565" onChange={(e) => setLonInput(e.target.value)} /></label>
                <button className="btn" onClick={() => { const v = Number(lonInput); if (Number.isFinite(v) && v >= -180 && v <= 180) onSetLongitude(v); else onToast('經度須在 -180 到 180 之間'); }}>套用</button>
                <button className="btn" onClick={onRequestGps}>用 GPS 取得</button>
              </div>
              <p className="hint">{gpsStatus || 'GPS 只在你按下時取得一次；未提供有效經度時不會使用真太陽時。'}</p>
            </>
          )}
        </details>
      </section>
    </div>
  );
}
