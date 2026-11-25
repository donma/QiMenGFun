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
  onToast: (msg: string) => void;
}

const emptyPerson = (): Person => ({
  id: uuid(), name: '', birthDate: null, birthTime: null,
  birthTimePrecision: 'unknown', sex: null, birthPlace: null,
  birthTimezone: null, createdAt: new Date().toISOString(),
});

export function ToolsPanel({ settings, persons, storage, onSettings, onAddPerson, onUpdatePerson, onDeletePerson, onSelectPerson, onCalibrate, onRequestSensor, onToast }: ToolsPanelProps) {
  const [editing, setEditing] = useState<Person | null>(null);
  const current = persons.find((p) => p.id === settings.currentPersonId);

  const save = () => {
    if (!editing) return;
    if (!editing.name.trim()) { onToast('請輸入名稱'); return; }
    (persons.some((p) => p.id === editing.id) ? onUpdatePerson : onAddPerson)({ ...editing, name: editing.name.trim() });
    setEditing(null);
    onToast('已保存');
  };

  return (
    <div className="panel-scroll">
      <section className="panel-section glass">
        <h2>方位感測</h2>
        <p className="hint">羅盤依手機鏡頭朝向轉動。若方向不準，先請求權限，再用「校正」對準已知方位。</p>
        <div className="form-row">
          <button className="btn" onClick={onRequestSensor}>允許方向感測</button>
          <button className="btn" onClick={onCalibrate}>校正方位</button>
        </div>
      </section>

      <section className="panel-section glass">
        <h2>人物（選用）</h2>
        <p className="hint">只有想看「年命」時才需要。不新增也能完整使用。</p>
        <p className="person-current">目前選用：<b>{current?.name ?? '無'}</b></p>
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
            <label>出生時間（不確定可空白）<input type="time" value={editing.birthTime ?? ''} onChange={(e) => setEditing({ ...editing, birthTime: e.target.value || null, birthTimePrecision: e.target.value ? 'exact' : 'unknown' })} /></label>
            <div className="form-row"><button className="btn primary" onClick={save}>保存</button><button className="btn" onClick={() => setEditing(null)}>取消</button></div>
          </div>
        )}
      </section>

      <section className="panel-section glass">
        <h2>顯示</h2>
        <label className="checkline"><input type="checkbox" checked={settings.reducedMotion} onChange={(e) => onSettings({ reducedMotion: e.target.checked })} /> 減少動態（太極不轉動）</label>
        <label className="checkline"><input type="checkbox" checked={settings.powerSave} onChange={(e) => onSettings({ powerSave: e.target.checked })} /> 省電模式（不保持螢幕恆亮）</label>
      </section>

      <section className="panel-section glass">
        <h2>關於與隱私</h2>
        <p className="hint">所有資料只存在這支手機：沒有帳號、不上傳、無廣告。可能因系統清除而遺失，請到「紀錄」定期匯出。</p>
        <div className="hint">{storage ? `已用 ${(storage.usage / 1048576).toFixed(1)} MB／配額 ${(storage.quota / 1048576).toFixed(0)} MB` : ''}</div>
        <p className="hint">本工具為傳統文化參考，不是科學驗證的預測，也不承諾求財、健康、投資等結果。</p>
        <details className="more">
          <summary>方法版本</summary>
          {PROFILES.map((p) => <div className="hint" key={p.id}>{p.label}：{p.id}@{p.version}</div>)}
        </details>
      </section>
    </div>
  );
}
