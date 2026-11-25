import { useState } from 'react';
import type { Chart } from '../domain/qimen/types';
import type { TimeState } from '../time/TimeController';
import { civilParts, formatOffset } from '../domain/calendar/timezone';
import { YUAN_NAME } from '../domain/qimen/tables';
import { HOUR_PROFILE_VERSION } from '../domain/qimen/hourEngine';
import { KE_PROFILE_VERSION } from '../domain/qimen/keEngine';

export interface TopInfoBarProps {
  chart: Chart | null;
  time: TimeState;
  longitude: number | null;
  gpsStatus: string;
}

function fmtTime(ms: number, tz: string): string {
  const c = civilParts(ms, tz);
  return `${String(c.year)}/${String(c.month).padStart(2, '0')}/${String(c.day).padStart(2, '0')} ${String(c.hour).padStart(2, '0')}:${String(c.minute).padStart(2, '0')}:${String(c.second).padStart(2, '0')}`;
}

export function TopInfoBar({ chart, time, longitude, gpsStatus }: TopInfoBarProps) {
  const [open, setOpen] = useState(false);
  const c = civilParts(time.instantMs, time.timezone);
  const correction = time.basis === 'apparent-solar' && longitude !== null
    ? `均時差＋經度修正（詳見展開）` : formatOffset(c.offsetMinutes);

  return (
    <div className={`top-info glass ${open ? 'open' : ''}`}>
      <button className="top-summary" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="top-date">
          <b>{fmtTime(time.instantMs, time.timezone)}</b>
          <span>{chart?.pillars.hour ?? '—'} · {time.mode === 'live' ? '即時' : time.mode === 'playing' ? '播放' : '預覽'}</span>
        </div>
        <div className="top-ju">
          {chart ? `${chart.dun === 'yang' ? '陽遁' : '陰遁'} ${chart.ju} 局` : '計算中'}
          <span>值符 {chart?.dutyStar ?? '—'} · 值使 {chart?.dutyDoor ?? '—'}</span>
        </div>
        <span className="top-caret" aria-hidden="true">{open ? '⌃' : '⌄'}</span>
      </button>
      <div className="top-detail">
        <div className="info-grid">
          <div><span>公曆／民用</span><b>{fmtTime(time.instantMs, time.timezone)}</b></div>
          <div><span>UTC offset</span><b>{formatOffset(c.offsetMinutes)}</b></div>
          <div><span>四柱</span><b>{chart ? `${chart.pillars.year} ${chart.pillars.month} ${chart.pillars.day} ${chart.pillars.hour}` : '—'}</b></div>
          <div><span>節氣</span><b>{chart?.term ?? '—'}</b></div>
          <div><span>時間基準</span><b>{time.basis === 'civil' ? '裝置當地標準鐘面' : '真太陽時'}</b></div>
          <div><span>修正量</span><b>{correction}</b></div>
          <div><span>經度</span><b>{longitude === null ? '未提供' : `${longitude.toFixed(3)}° (${gpsStatus || '手填'})`}</b></div>
          <div><span>有效時間</span><b>{chart ? `${fmtTime(chart.validFromMs, time.timezone)} – ${fmtTime(chart.validUntilMs, time.timezone)}` : '—'}</b></div>
        </div>
        <div className="double-chart">
          <div className="chart-box">
            <b>時家</b>
            <span>{chart ? `${chart.term} · ${chart.yuan ? YUAN_NAME[chart.yuan] : ''} · ${chart.dun === 'yang' ? '陽遁' : '陰遁'}${chart.ju}局` : '—'}</span>
            <span>值符 {chart?.dutyStar ?? '—'} / 值使 {chart?.dutyDoor ?? '—'}</span>
            <small>方法版本 hour-zhuan-chaibu-v1@{HOUR_PROFILE_VERSION}</small>
          </div>
          <div className="chart-box ke-box">
            <b>刻家</b>
            <span className="unverified">刻家規則尚待驗證</span>
            <span>僅提供 12 刻時間索引；不顯示吉方或推薦</span>
            <small>方法版本 ke-unverified-v1@{KE_PROFILE_VERSION}</small>
          </div>
        </div>
      </div>
    </div>
  );
}
