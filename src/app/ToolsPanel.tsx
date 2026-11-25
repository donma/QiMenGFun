import { useState } from 'react';
import type { AppSettings, Person } from '../storage/storage';
import { uuid } from '../storage/storage';
import { PROFILES } from '../domain/qimen/profileRegistry';

export interface ToolsPanelProps {
  settings: AppSettings;
  persons: Person[];
  storage: { usage: number; quota: number } | null;
  onSettings: (patch: Partial<AppSettings>) => void;
  onAddPerson: (p: Person) => void;
  onUpdatePerson: (p: Person) => void;
  onDeletePerson: (id: string) => void;
  onSelectPerson: (id: string | null) => void;
  onCalibrate: () => void;
  onRequestSensor: () => void;
  gpsStatus: string;
  onToast: (msg: string) => void;
}

const emptyPerson = (): Person => ({
  id: uuid(), name: '', birthDate: null, birthTime: null,
  birthTimePrecision: 'unknown', sex: null, birthPlace: null,
  birthTimezone: null, createdAt: new Date().toISOString(),
});

export function ToolsPanel({ settings, persons, storage, onSettings, onAddPerson, onUpdatePerson, onDeletePerson, onSelectPerson, onCalibrate, onRequestSensor, gpsStatus, onToast }: ToolsPanelProps) {
  const [editing, setEditing] = useState<Person | null>(null);

  const save = () => {
    if (!editing) return;
    if (!editing.name.trim()) { onToast('名稱為必填'); return; }
    (persons.some((p) => p.id === editing.id) ? onUpdatePerson : onAddPerson)({ ...editing, name: editing.name.trim() });
    setEditing(null);
    onToast('人物已保存');
  };

  return (
    <div className="panel-scroll">
      <section className="panel-section glass">
        <h2>人物（選用）</h2>
        <p className="hint">首次不強制建人。年命分析至少需要可信出生年；立春附近缺時間不猜年干。</p>
        <p className="person-current">目前選用：<b>{persons.find((p) => p.id === settings.currentPersonId)?.name ?? '無'}</b>{settings.currentPersonId === null && '（不影響基礎盤）'}</p>
        <div className="person-list">
          <button className={`person-pill ${settings.currentPersonId === null ? 'on' : ''}`} onClick={() => onSelectPerson(null)}>不選人物</button>
          {persons.map((p) => (
            <div className={`person-row ${settings.currentPersonId === p.id ? 'on' : ''}`} key={p.id}>
              <button className="person-name" onClick={() => onSelectPerson(p.id)}>{p.name}</button>
              <button className="mini-btn" onClick={() => setEditing({ ...p })}>編輯</button>
              <button className="mini-btn danger" onClick={() => onDeletePerson(p.id)}>刪除</button>
            </div>
          ))}
        </div>
        <button className="btn primary person-add" onClick={() => setEditing(emptyPerson())}>＋ 新增人物</button>
        {editing && (
          <div className="person-editor">
            <label>名稱（必填）<input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label>
            <label>生日<input type="date" value={editing.birthDate ?? ''} onChange={(e) => setEditing({ ...editing, birthDate: e.target.value || null })} /></label>
            <label>出生時間<input type="time" value={editing.birthTime ?? ''} onChange={(e) => setEditing({ ...editing, birthTime: e.target.value || null })} /></label>
            <label>時間精度<select value={editing.birthTimePrecision} onChange={(e) => setEditing({ ...editing, birthTimePrecision: e.target.value as Person['birthTimePrecision'] })}>
              <option value="exact">精確時分</option><option value="hour">已知時辰</option><option value="unknown">未知</option>
            </select></label>
            <label>性別（可不填）<select value={editing.sex ?? ''} onChange={(e) => setEditing({ ...editing, sex: (e.target.value || null) as Person['sex'] })}>
              <option value="">未填</option><option value="male">男</option><option value="female">女</option>
            </select></label>
            <label>出生地<input value={editing.birthPlace ?? ''} onChange={(e) => setEditing({ ...editing, birthPlace: e.target.value || null })} /></label>
            <label>出生時區<input value={editing.birthTimezone ?? ''} placeholder="Asia/Taipei" onChange={(e) => setEditing({ ...editing, birthTimezone: e.target.value || null })} /></label>
            <div className="form-row"><button className="btn primary" onClick={save}>保存</button><button className="btn" onClick={() => setEditing(null)}>取消</button></div>
          </div>
        )}
      </section>

      <section className="panel-section glass">
        <h2>時間與方位</h2>
        <label className="select-label">時間基準
          <select value={settings.basis} onChange={(e) => onSettings({ basis: e.target.value as AppSettings['basis'] })}>
            <option value="civil">裝置當地標準鐘面</option><option value="apparent-solar">真太陽時</option>
          </select>
        </label>
        <label>時區<input value={settings.timezone} onChange={(e) => onSettings({ timezone: e.target.value })} /></label>
        <label className="select-label">北向基準
          <select value={settings.northReference} onChange={(e) => onSettings({ northReference: e.target.value as AppSettings['northReference'] })}>
            <option value="magnetic">磁北（預設；第一版不自動換真北）</option>
          </select>
        </label>
        <div className="form-row"><button className="btn" onClick={onRequestSensor}>請求方向權限</button><button className="btn" onClick={onCalibrate}>手動校正方位</button></div>
        <div className="hint">{gpsStatus || '手動校正不等同已知真北；相對資料不冒充絕對北。鏡頭近垂直時凍結最後有效讀數。'}</div>
      </section>

      <section className="panel-section glass">
        <h2>光效與效能</h2>
        <label className="select-label">光效主題
          <select value={settings.lightTheme} onChange={(e) => onSettings({ lightTheme: e.target.value as AppSettings['lightTheme'] })}>
            <option value="focus">C 吉方聚焦（預設）</option><option value="all">A 全盤</option><option value="blue">B 純藍</option>
          </select>
        </label>
        <label className="select-label">盤層
          <select value={settings.layerPreset} onChange={(e) => onSettings({ layerPreset: e.target.value as AppSettings['layerPreset'] })}>
            <option value="simple">簡易</option><option value="professional">專業（預設）</option><option value="custom">自訂</option>
          </select>
        </label>
        {settings.layerPreset === 'custom' && (
          <div className="layer-checks">
            {['earth', 'heaven', 'stars', 'doors', 'deities', 'outer', 'light', 'ke'].map((layer) => (
              <label className="checkline" key={layer}><input type="checkbox" checked={settings.customLayers.includes(layer)} onChange={(e) => {
                const next = e.target.checked ? [...settings.customLayers, layer] : settings.customLayers.filter((x) => x !== layer);
                onSettings({ customLayers: next });
              }} /> {layer}</label>
            ))}
          </div>
        )}
        <label className="checkline"><input type="checkbox" checked={settings.reducedMotion} onChange={(e) => onSettings({ reducedMotion: e.target.checked })} /> 減少動態（停止呼吸／粒子／太極轉動）</label>
        <label className="checkline"><input type="checkbox" checked={settings.powerSave} onChange={(e) => onSettings({ powerSave: e.target.checked })} /> 省電模式（前景降至 30fps）</label>
      </section>

      <section className="panel-section glass">
        <h2>資料容量與關於</h2>
        <div className="hint">{storage ? `已用 ${(storage.usage / 1048576).toFixed(1)} MB / 配額 ${(storage.quota / 1048576).toFixed(0)} MB` : '無法取得容量資訊'}</div>
        <p className="hint">無帳號、後端、廣告、分析 SDK；所有資料本機處理。資料僅本機可能因系統清除遺失，請定期從紀錄頁匯出。</p>
        <h3>方法版本</h3>
        {PROFILES.map((p) => <div className="hint" key={p.id}>{p.label}：{p.id}@{p.version} — {p.note}</div>)}
        <p className="hint">本App為傳統文化參考，非科學驗證的預測或物理能量量測；不承諾求財、健康、投資等結果。</p>
      </section>
    </div>
  );
}
