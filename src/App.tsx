import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { HOUR_PROFILE_ID, computeHourChart } from './domain/qimen/hourEngine';
import { KE_PROFILE_ID, computeKeChart, keTimeIndex } from './domain/qimen/keEngine';
import { analyzeChart, EVENT_PROFILES, type EventKind } from './domain/analysis/eventProfiles';
import { DIRECTIONS } from './domain/compass/directions';
import { directionAt } from './domain/compass/directions';
import type { PalaceId } from './domain/qimen/types';
import { useHeading } from './sensors/useHeading';
import { useStableSector } from './sensors/useStableSector';
import { createCameraManager, type CameraState } from './camera/cameraManager';
import { composeCapture } from './camera/composite';
import { TimeController } from './time/TimeController';
import { QimenDial, type DialLayers } from './components/QimenDial';
import { TopInfoBar } from './components/TopInfoBar';
import { TimeFlowBar } from './components/TimeFlowBar';
import { PalaceCard } from './components/PalaceCard';
import { Onboarding } from './app/Onboarding';
import { AnalysisPanel } from './app/AnalysisPanel';
import { TimePanel } from './app/TimePanel';
import { RecordsPanel } from './app/RecordsPanel';
import { ToolsPanel } from './app/ToolsPanel';
import {
  loadLS, saveLS, listRecords, listPhotos, putPhoto, putRecord, deleteRecord, deletePhoto,
  estimateStorage, uuid,
  type AppSettings, type LSData, type Person, type PhotoRecordMeta,
} from './storage/storage';

type Tab = 'compass' | 'analysis' | 'time' | 'records' | 'tools';

const TABS: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'compass', label: '羅盤', icon: '◎' },
  { id: 'analysis', label: '分析', icon: '▦' },
  { id: 'time', label: '時光', icon: '◷' },
  { id: 'records', label: '紀錄', icon: '▤' },
  { id: 'tools', label: '工具', icon: '⚙' },
];

export default function App() {
  const [ls, setLs] = useState<LSData>(() => loadLS());
  const settings = ls.settings;
  const [tab, setTab] = useState<Tab>('compass');
  const [selected, setSelected] = useState<PalaceId | null>(null);
  const [sheet, setSheet] = useState(false);
  const [toast, setToast] = useState('');
  const [records, setRecords] = useState<PhotoRecordMeta[]>([]);
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [detail, setDetail] = useState<PhotoRecordMeta | null>(null);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState('');
  const [camState, setCamState] = useState<CameraState>('idle');
  const [showCalibration, setShowCalibration] = useState(false);

  const sceneRef = useRef<HTMLDivElement>(null);
  const videoHostRef = useRef<HTMLDivElement>(null);
  const dialWrapRef = useRef<HTMLDivElement>(null);
  const camRef = useRef<ReturnType<typeof createCameraManager> | null>(null);
  const toastTimer = useRef<number | null>(null);
  const dragRef = useRef<{ lastAngle: number; accum: number } | null>(null);
  const wakeRef = useRef<WakeLockSentinel | null>(null);
  const autoCameraTried = useRef(false);

  const controllerRef = useRef<TimeController | null>(null);
  if (!controllerRef.current) {
    controllerRef.current = new TimeController({
      basis: settings.basis, timezone: settings.timezone, longitude: settings.longitude ?? undefined,
      wallNowMs: Date.now(),
    });
  }
  const controller = controllerRef.current;
  const time = useSyncExternalStore(controller.subscribe, controller.getSnapshot);

  const heading = useHeading(tab === 'compass' && settings.onboarded && !showCalibration, settings.northReference);
  const stableSector = useStableSector(heading.state.displayHeading, heading.state.tiltDegraded || heading.state.quality === 'unavailable');

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 3200);
  }, []);

  const patchSettings = useCallback((patch: Partial<AppSettings>) => {
    setLs((prev) => {
      const next = { ...prev, settings: { ...prev.settings, ...patch } };
      saveLS(next);
      return next;
    });
  }, []);

  // 時間與設定同步
  useEffect(() => {
    controller.setTimeConfig({ basis: settings.basis, timezone: settings.timezone, longitude: settings.longitude ?? undefined });
  }, [controller, settings.basis, settings.timezone, settings.longitude]);

  // rAF 單一時鐘；背景停止
  useEffect(() => {
    let raf = 0;
    const loop = (perf: number) => {
      controller.tick(perf, Date.now());
      raf = requestAnimationFrame(loop);
    };
    if (!document.hidden) raf = requestAnimationFrame(loop);
    const onVis = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) {
        raf = requestAnimationFrame(loop);
        controller.resync(Date.now());
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', onVis); };
  }, [controller]);

  // Wake lock（foreground only）
  useEffect(() => {
    let cancelled = false;
    const acquire = async () => {
      if (document.hidden || settings.powerSave || !navigator.wakeLock) return;
      try { wakeRef.current = await navigator.wakeLock.request('screen'); } catch { /* unsupported */ }
    };
    void acquire();
    const onVis = () => { void acquire(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { cancelled = true; void wakeRef.current?.release().catch(() => {}); document.removeEventListener('visibilitychange', onVis); void cancelled; };
  }, [settings.powerSave]);

  // 相機生命週期：離開實景頁關閉；返回恢復
  const startCamera = useCallback(async () => {
    if (!camRef.current) camRef.current = createCameraManager();
    camRef.current.onEnded = () => { setCamState('ended'); showToast('相機連線中斷，可重試'); };
    if (videoHostRef.current && !videoHostRef.current.querySelector('video')) {
      videoHostRef.current.appendChild(camRef.current.video ?? document.createElement('video'));
    }
    try {
      const ok = await camRef.current.start();
      setCamState(ok ? 'running' : 'idle');
      return ok;
    } catch (err) {
      setCamState((err as Error).name === 'NotAllowedError' ? 'denied' : 'failed');
      return false;
    }
  }, [showToast]);

  const stopCamera = useCallback(() => {
    camRef.current?.stop();
    setCamState('idle');
  }, []);

  // video 元素可能比 camera manager 晚掛載（首次歡迎頁）；每次渲染檢查並補掛。
  useEffect(() => {
    const host = videoHostRef.current;
    const v = camRef.current?.video;
    if (host && v && !host.contains(v)) host.appendChild(v);
  });

  // 回到／首次進入實景頁時自動啟動相機；已授權時直接出即時影像，未授權時仍可用純盤。
  useEffect(() => {
    if (!settings.onboarded || tab !== 'compass' || autoCameraTried.current) return;
    autoCameraTried.current = true;
    void startCamera().catch(() => {});
  }, [settings.onboarded, tab, startCamera]);

  useEffect(() => {
    if (tab !== 'compass' || !settings.onboarded) {
      autoCameraTried.current = false;
      stopCamera();
    }
  }, [tab, settings.onboarded, stopCamera]);

  useEffect(() => {
    const onVis = () => { if (document.hidden) stopCamera(); };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [stopCamera]);

  // 紀錄與縮圖
  const refreshRecords = useCallback(async () => {
    const list = await listRecords();
    setRecords(list);
    const next = new Map<string, string>();
    const photos = await listPhotos();
    for (const p of photos.slice(0, 30)) next.set(p.id, URL.createObjectURL(p.blob));
    setUrls((old) => { old.forEach((u) => URL.revokeObjectURL(u)); return next; });
    const est = await estimateStorage().catch(() => null);
    setStorage(est);
  }, []);
  useEffect(() => { if (settings.onboarded) void refreshRecords(); }, [settings.onboarded, refreshRecords]);

  // 盤局（memo；不在 rAF 重算）
  const chartInput = useMemo(() => ({
    instantMs: time.instantMs, timezone: time.timezone, basis: time.basis,
    longitude: time.longitude ?? undefined, profileId: HOUR_PROFILE_ID,
  }), [time.instantMs, time.timezone, time.basis, time.longitude]);
  const hourResult = useMemo(() => computeHourChart(chartInput), [chartInput]);
  const chart = hourResult.status === 'ok' ? hourResult.chart : null;
  const keResult = useMemo(() => computeKeChart({ ...chartInput, profileId: KE_PROFILE_ID }), [chartInput]);
  const keStatus = keResult.status === 'unverified' ? 'unverified' : keResult.status;
  const event = (EVENT_PROFILES.find((p) => p.id === settings.eventKind) ? settings.eventKind : 'general') as EventKind;
  const analysis = useMemo(() => (chart ? analyzeChart(chart, event) : null), [chart, event]);

  const layers: DialLayers = useMemo(() => {
    const custom = settings.customLayers;
    const on = (k: string) => settings.layerPreset === 'professional' ? k !== 'ke' : settings.layerPreset === 'custom' && custom.includes(k);
    return {
      earth: on('earth'), heaven: on('heaven'), stars: on('stars'), doors: on('doors'),
      deities: on('deities'), outer: on('outer'), light: on('light'), ke: on('ke'),
    };
  }, [settings.layerPreset, settings.customLayers]);

  const degree = heading.state.displayHeading;
  const stable = stableSector;
  const selectedP = selected ? chart?.palaces.find((p) => p.id === selected) : null;
  const currentDir = degree === null ? null : directionAt(degree);
  const keIndex = keTimeIndex({ ...chartInput, profileId: KE_PROFILE_ID }, time.instantMs).keIndex;

  // 外圈拖曳：120 分鐘跨度映射角度，跨 0° 累積，明確命中外圈才 pointer capture
  const onDialPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = dialWrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dist = Math.hypot(e.clientX - cx, e.clientY - cy);
    if (dist < r.width * 0.38 || dist > r.width * 0.52) return;
    const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
    dragRef.current = { lastAngle: angle, accum: 0 };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onDialPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const el = dialWrapRef.current!;
    const r = el.getBoundingClientRect();
    const angle = Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
    let delta = angle - d.lastAngle;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    d.accum += delta;
    d.lastAngle = angle;
    if (Math.abs(d.accum) >= 3) {
      const minutes = -(d.accum / 360) * 120;
      controller.setInstant(time.instantMs + minutes * 60_000, performance.now());
      d.accum = 0;
    }
  };
  const onDialPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    dragRef.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const capture = async () => {
    if (!sceneRef.current) return;
    try {
      const blob = await composeCapture({
        video: camRef.current?.video ?? null,
        sceneEl: sceneRef.current,
        dialEl: dialWrapRef.current?.querySelector('svg') ?? null,
        info: {
          headline: chart ? `${chart.dun === 'yang' ? '陽遁' : '陰遁'}${chart.ju}局 · ${chart.term}` : '盤局不可用',
          main: chart ? `${chart.pillars.hour} · 值符${chart.dutyStar} · 值使${chart.dutyDoor}` : '—',
          meta: `${new Date(time.instantMs).toLocaleString('zh-Hant')} · ${time.basis === 'civil' ? '民用時' : '真太陽時'} · ${time.timezone}`,
          tone: 'warn',
          warn: keResult.status === 'unverified' ? '刻家規則尚待驗證' : undefined,
        },
      });
      const photoId = uuid();
      await putPhoto({ id: photoId, blob, mimeType: 'image/jpeg', createdAt: new Date().toISOString() });
      const record: PhotoRecordMeta = {
        id: uuid(), personId: settings.currentPersonId, title: '', note: '',
        capturedAt: new Date().toISOString(), chartInstant: new Date(time.instantMs).toISOString(),
        chartHash: chart?.hash ?? '', chartKind: 'hour',
        chart: chart ? {
          hash: chart.hash, kind: chart.kind, profileVersion: chart.profileVersion,
          term: chart.term, ju: chart.ju, dun: chart.dun, pillars: chart.pillars as unknown as Record<string, string>,
          palaces: chart.palaces as unknown, validFromMs: chart.validFromMs, validUntilMs: chart.validUntilMs,
        } : null,
        keStatus: 'unverified', profileVersion: chart?.profileVersion ?? '',
        basis: time.basis, timezone: time.timezone, longitude: time.longitude ?? null,
        headingRaw: heading.state.rawHeading, headingDisplay: heading.state.displayHeading,
        quality: heading.state.quality,
        source: heading.state.source === 'manual' ? 'manual' : 'sensor',
        northReference: settings.northReference,
        nearBoundary: heading.state.nearBoundary || Boolean(chart && time.instantMs > chart.validUntilMs - 60_000),
        photoId, simulated: time.mode !== 'live' || heading.state.quality !== 'valid',
        schemaVersion: 1,
      };
      await putRecord(record);
      await refreshRecords();
      showToast(time.mode !== 'live' ? '已儲存（模擬時間，照片加註）' : '照片與盤局已儲存');
    } catch (err) {
      showToast(`拍照失敗：${(err as Error).message}`);
    }
  };

  const requestGps = () => {
    if (!navigator.geolocation) { showToast('此裝置不支援 GPS'); return; }
    setGpsStatus('取得中…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lon = Math.round(pos.coords.longitude * 10000) / 10000;
        patchSettings({ longitude: lon });
        setGpsStatus(`GPS 精度 ±${pos.coords.accuracy.toFixed(0)}m · ${new Date(pos.timestamp).toLocaleTimeString('zh-Hant')}`);
        showToast(`已取得經度 ${lon}°（仅此一次）`);
      },
      () => { setGpsStatus('GPS 遭拒；可手填經度'); showToast('GPS 遭拒；可手填經度'); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const person: Person | null = ls.persons.find((p) => p.id === settings.currentPersonId) ?? null;

  if (!settings.onboarded) {
    return <>
      <Onboarding
        onStart={() => {
          patchSettings({ onboarded: true });
          setTab('compass');
          void startCamera().then((ok) => showToast(ok ? '相機已開啟，實景背景使用中' : '相機未授權；仍可使用純盤，點左側「實景」可重試'));
        }}
        onRequestCamera={async () => { const ok = await startCamera(); showToast(ok ? '相機已授權' : '相機未授權；仍可使用純盤'); }}
        onRequestSensor={async () => { const p = await heading.requestPermission(); showToast(p === 'granted' ? '方向權限已授權' : '可稍後手動校正方位'); }}
        cameraLabel={camState === 'running' ? '相機已開啟' : '允許相機'}
        sensorLabel={heading.permission === 'granted' ? '方向已授權' : '請求方向權限'}
      />
      {toast && <div className="toast" role="status">{toast}</div>}
    </>;
  }

  return (
    <div className="app" ref={sceneRef}>
      <div className="scene-media" ref={videoHostRef} aria-hidden="true" />
      <div className="scene-fallback" aria-hidden="true" />
      <div className="scene-scrim top" aria-hidden="true" />
      <div className="scene-scrim bottom" aria-hidden="true" />

      <header className="brand-bar">
        <button className="icon-btn" onClick={() => setTab('tools')} aria-label="工具選單">☰</button>
        <div className="brand-title">QiMenGFun <span>奇門吉方</span></div>
        <button className="icon-btn" onClick={() => setTab('tools')} aria-label="設定">⚙</button>
      </header>

      <TopInfoBar chart={chart} time={time} longitude={settings.longitude} gpsStatus={gpsStatus} />

      {tab === 'compass' && <>
        <aside className="rail left" aria-label="快捷功能">
          <button className="rail-btn on" onClick={() => { setTab('compass'); if (camState !== 'running') void startCamera(); }}><span>◉</span>實景</button>
          <button className="rail-btn" onClick={() => setTab('time')}><span>◷</span>時光</button>
          <button className="rail-btn" onClick={() => controller.play(performance.now())}><span>▶</span>流轉</button>
          <button className="rail-btn" onClick={() => setTab('analysis')}><span>▦</span>九宮</button>
          <button className="rail-btn" onClick={() => setTab('tools')}><span>☷</span>盤層</button>
        </aside>

        <div className="compass-wrap" ref={dialWrapRef} onPointerDown={onDialPointerDown} onPointerMove={onDialPointerMove} onPointerUp={onDialPointerUp}>
          <QimenDial
            chart={chart} heading={degree}
            headingQuality={degree === null ? 'unavailable' : heading.state.quality}
            selected={selected} onSelect={(id) => { setSelected(id); setSheet(false); }}
            assessment={analysis} lightTheme={settings.lightTheme} layers={layers}
            reducedMotion={settings.reducedMotion || settings.powerSave} demo={degree === null}
          />
          <div className="dial-badges">
            <span className={`badge ${degree === null ? 'muted' : ''}`}>{degree === null ? '示範方位' : `${degree.toFixed(0)}° ${currentDir?.name ?? ''}`}</span>
            <span className="badge">{keStatus === 'unverified' ? `第 ${keIndex + 1} 刻（規則待驗證）` : '刻盤'}</span>
          </div>
        </div>

        <aside className="rail right" aria-label="方位資訊">
          <div className="heading-card glass">
            <span>朝向</span>
            <b>{degree === null ? '—' : degree.toFixed(0)}°</b>
            <small className="wide-only">{currentDir?.name ?? '—'} · {heading.state.source === 'manual' ? '手動' : heading.state.quality}</small>
            <button className="mini-btn" onClick={() => setShowCalibration(true)}>校正</button>
          </div>
          <div className="direction-card glass wide-only">
            <span>宮位</span>
            <b>{currentDir?.short ?? '—'}</b>
            <small>時盤：{selectedP?.door ?? '—'}</small>
            <small>穩定扇區 {stable === null ? '—' : directionAt(stable).short}</small>
          </div>
          <div className="verdict-card glass">
            <span className="wide-only">事件</span>
            <small>{EVENT_PROFILES.find((e) => e.id === event)?.label}</small>
            {camState !== 'running' && <button className="mini-btn" onClick={() => void startCamera()}>開相機</button>}
            <button className="mini-btn" onClick={() => setTab('analysis')}>分析</button>
            <button className="mini-btn" onClick={capture}>拍照</button>
          </div>
        </aside>

        {selected && (
          <PalaceCard chart={chart} palaceId={selected} assessment={analysis}
            eventLabel={EVENT_PROFILES.find((e) => e.id === event)?.label ?? event}
            heading={degree} expanded={sheet} onExpand={setSheet}
            onClose={() => { setSelected(null); setSheet(false); }}
            onSelect={(id) => setSelected(id)} />
        )}

        <TimeFlowBar state={time} onSeek={(ms) => controller.setInstant(ms, performance.now())}
          onPlay={() => controller.play(performance.now())} onNow={() => controller.toLive(performance.now())}
          onSpeed={(s) => controller.setSpeed(s, performance.now())}
          onDirection={(d) => controller.setDirection(d, performance.now())} />
      </>}

      {tab !== 'compass' && (
        <main className="panel-host">
          <div className="panel-head">
            <button className="icon-btn" onClick={() => setTab('compass')} aria-label="返回羅盤">←</button>
            <h1>{TABS.find((t) => t.id === tab)?.label}</h1>
          </div>
          {tab === 'analysis' && <AnalysisPanel chart={chart} keStatus={keStatus === 'unverified' ? '刻家規則尚待驗證' : keStatus}
            analysis={analysis} event={event} onEvent={(e) => patchSettings({ eventKind: e })}
            person={person} selected={selected} onSelect={(id) => { setSelected(id); setSheet(false); setTab('compass'); }} onToast={showToast} />}
          {tab === 'time' && <TimePanel time={time} onSetInstant={(ms) => controller.setInstant(ms, performance.now())}
            onSetBasis={(b) => patchSettings({ basis: b })} onSetLongitude={(lon) => patchSettings({ longitude: lon })}
            onRequestGps={requestGps} gpsStatus={gpsStatus} chart={chart} event={event} onToast={showToast} />}
          {tab === 'records' && <RecordsPanel records={records} urls={urls} onView={setDetail}
            onDelete={async (r) => { await deleteRecord(r.id); if (r.photoId) await deletePhoto(r.photoId); await refreshRecords(); showToast('已刪除'); }} onToast={showToast} />}
          {tab === 'tools' && <ToolsPanel settings={settings} persons={ls.persons} storage={storage}
            onSettings={patchSettings}
            onAddPerson={(p) => setLs((prev) => { const next = { ...prev, persons: [...prev.persons, p], settings: { ...prev.settings, currentPersonId: p.id } }; saveLS(next); return next; })}
            onUpdatePerson={(p) => setLs((prev) => { const next = { ...prev, persons: prev.persons.map((x) => x.id === p.id ? p : x) }; saveLS(next); return next; })}
            onDeletePerson={(id) => setLs((prev) => { const next = { ...prev, persons: prev.persons.filter((x) => x.id !== id), settings: { ...prev.settings, currentPersonId: prev.settings.currentPersonId === id ? null : prev.settings.currentPersonId } }; saveLS(next); return next; })}
            onSelectPerson={(id) => patchSettings({ currentPersonId: id })}
            onCalibrate={() => setShowCalibration(true)} onRequestSensor={async () => { const p = await heading.requestPermission(); showToast(p === 'granted' ? '方向權限已授權' : '可手動校正'); }}
            gpsStatus={gpsStatus} onToast={showToast} />}
        </main>
      )}

      <nav className="tabbar" aria-label="主分頁">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'on' : ''}`} onClick={() => { setTab(t.id); if (t.id !== 'compass') { setSelected(null); setSheet(false); } }} aria-current={tab === t.id ? 'page' : undefined}>
            <span className="tab-icon">{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </nav>

      {showCalibration && (
        <div className="modal-backdrop" onClick={() => setShowCalibration(false)}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="方位校正">
            <h2>手動校正方位</h2>
            <p className="hint">讓目前鏡頭朝向對齐所選方位。手動校正不等同已知真北；偏移只保存於本次執行。</p>
            <div className="calibrate-grid">
              {DIRECTIONS.map((d) => <button key={d.deg} className="btn" onClick={() => { heading.calibrateTo(d.deg); setShowCalibration(false); showToast(`已校正至 ${d.name}`); }}>{d.name} {d.deg}°</button>)}
            </div>
            <button className="btn" onClick={() => { heading.setManualOffsetDeg(0); setShowCalibration(false); showToast('已重設校正'); }}>重設</button>
          </div>
        </div>
      )}

      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <div className="modal glass detail-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="紀錄詳情">
            <h2>{detail.title || '紀錄詳情'}</h2>
            {detail.photoId && urls.get(detail.photoId) && <img className="detail-photo" src={urls.get(detail.photoId)} alt={detail.title} />}
            <div className="hint">拍攝 {detail.capturedAt} · 盤局時刻 {detail.chartInstant} {detail.simulated ? '（模擬時間）' : ''}</div>
            <div className="hint">盤局 {detail.chart?.term ?? '—'} · {detail.chart?.dun === 'yang' ? '陽遁' : '陰遁'}{detail.chart?.ju ?? '—'}局 · hash {detail.chartHash.slice(0, 8)}</div>
            <button className="btn" onClick={() => setDetail(null)}>關閉</button>
          </div>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
