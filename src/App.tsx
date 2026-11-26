import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { HOUR_PROFILE_ID, computeHourChart } from './domain/qimen/hourEngine';
import { KE_PROFILE_ID, computeKeChart } from './domain/qimen/keEngine';
import { analyzeChart, EVENT_PROFILES, yongshenOf, type EventKind } from './domain/analysis/eventProfiles';
import { DIRECTIONS } from './domain/compass/directions';
import { PALACES } from './domain/qimen/tables';
import type { PalaceId } from './domain/qimen/types';
import { useHeading } from './sensors/useHeading';
import { useStableSector } from './sensors/useStableSector';
import { createCameraManager, type CameraState } from './camera/cameraManager';
import { composeCapture } from './camera/composite';
import { TimeController } from './time/TimeController';
import { QimenDial } from './components/QimenDial';
import { TopInfoBar } from './components/TopInfoBar';
import { PalaceCard } from './components/PalaceCard';
import { Onboarding } from './app/Onboarding';
import { AnalysisPanel } from './app/AnalysisPanel';
import { TimePanel } from './app/TimePanel';
import { RecordsPanel } from './app/RecordsPanel';
import { ToolsPanel } from './app/ToolsPanel';
import { TONE_CLASS, TONE_LABEL } from './styles/tone';
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
  const [detailOpen, setDetailOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [records, setRecords] = useState<PhotoRecordMeta[]>([]);
  const [urls, setUrls] = useState<Map<string, string>>(new Map());
  const [detail, setDetail] = useState<PhotoRecordMeta | null>(null);
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState('');
  const [camState, setCamState] = useState<CameraState>('idle');
  const [showCalibration, setShowCalibration] = useState(false);
  const [showLegend, setShowLegend] = useState(false);

  const sceneRef = useRef<HTMLDivElement>(null);
  const videoHostRef = useRef<HTMLDivElement>(null);
  const dialWrapRef = useRef<HTMLDivElement>(null);
  const camRef = useRef<ReturnType<typeof createCameraManager> | null>(null);
  const toastTimer = useRef<number | null>(null);
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

  useEffect(() => {
    controller.setTimeConfig({ basis: settings.basis, timezone: settings.timezone, longitude: settings.longitude ?? undefined });
  }, [controller, settings.basis, settings.timezone, settings.longitude]);

  // 單一時鐘；背景頁停止
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

  useEffect(() => {
    const acquire = async () => {
      if (document.hidden || settings.powerSave || !navigator.wakeLock) return;
      try { wakeRef.current = await navigator.wakeLock.request('screen'); } catch { /* unsupported */ }
    };
    void acquire();
    const onVis = () => { void acquire(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { void wakeRef.current?.release().catch(() => {}); document.removeEventListener('visibilitychange', onVis); };
  }, [settings.powerSave]);

  // ---- 相機 ----
  const startCamera = useCallback(async () => {
    if (!camRef.current) camRef.current = createCameraManager();
    const cam = camRef.current;
    cam.onEnded = () => { setCamState('ended'); showToast('相機連線中斷，可點右上「開啟相機」重試'); };
    const host = videoHostRef.current;
    if (host && cam.video && !host.contains(cam.video)) host.appendChild(cam.video);
    setCamState('starting');
    try {
      const ok = await cam.start();
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

  // video 元素可能比圖層晚掛載（歡迎頁 → 羅盤頁）；每次渲染補掛。
  useEffect(() => {
    const host = videoHostRef.current;
    const v = camRef.current?.video;
    if (host && v && !host.contains(v)) host.appendChild(v);
  });

  useEffect(() => {
    if (!settings.onboarded) return;
    if (tab !== 'compass') {
      autoCameraTried.current = false;
      stopCamera();
      return;
    }
    if (autoCameraTried.current) return;
    autoCameraTried.current = true;
    void startCamera();
  }, [tab, settings.onboarded, startCamera, stopCamera]);

  useEffect(() => {
    const onVis = () => {
      if (document.hidden) { stopCamera(); autoCameraTried.current = false; }
      else if (tab === 'compass' && settings.onboarded && !autoCameraTried.current) {
        autoCameraTried.current = true;
        void startCamera();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [stopCamera, startCamera, tab, settings.onboarded]);

  // ---- 紀錄 ----
  const refreshRecords = useCallback(async () => {
    const list = await listRecords();
    setRecords(list);
    const next = new Map<string, string>();
    const photos = await listPhotos();
    for (const p of photos.slice(0, 30)) next.set(p.id, URL.createObjectURL(p.blob));
    setUrls((old) => { old.forEach((u) => URL.revokeObjectURL(u)); return next; });
    setStorage(await estimateStorage().catch(() => null));
  }, []);
  useEffect(() => { if (settings.onboarded) void refreshRecords(); }, [settings.onboarded, refreshRecords]);

  // ---- 盤局（memo；不在 rAF 重算）----
  const chartInput = useMemo(() => ({
    instantMs: time.instantMs, timezone: time.timezone, basis: time.basis,
    longitude: time.longitude ?? undefined, profileId: HOUR_PROFILE_ID,
  }), [time.instantMs, time.timezone, time.basis, time.longitude]);
  const hourResult = useMemo(() => computeHourChart(chartInput), [chartInput]);
  const chart = hourResult.status === 'ok' ? hourResult.chart : null;
  const keResult = useMemo(() => computeKeChart({ ...chartInput, profileId: KE_PROFILE_ID }), [chartInput]);
  const event = (EVENT_PROFILES.find((p) => p.id === settings.eventKind) ? settings.eventKind : 'general') as EventKind;
  const eventLabel = EVENT_PROFILES.find((e) => e.id === event)?.label ?? event;
  const analysis = useMemo(() => (chart ? analyzeChart(chart, event) : null), [chart, event]);

  const degree = heading.state.displayHeading;
  // 盤面旋轉只更新一個 CSS 變數，不重繪約 200 個 SVG 節點
  useEffect(() => {
    dialWrapRef.current?.style.setProperty('--rot', `${degree ?? 0}deg`);
  }, [degree, tab]);
  const facingDirDef = stableSector === null ? null : DIRECTIONS.find((d) => d.deg === stableSector) ?? null;
  const focusId: PalaceId | null = selected ?? facingDirDef?.palaceId ?? null;
  const focusDef = focusId ? PALACES.find((p) => p.id === focusId) ?? null : null;
  const focusPalace = focusId ? chart?.palaces.find((p) => p.id === focusId) ?? null : null;
  const focusAssess = focusId ? analysis?.directions.find((d) => d.palaceId === focusId) ?? null : null;
  const focusFav = focusAssess?.favorability ?? 'unknown';
  const goodDirs = useMemo(() => (analysis?.directions ?? [])
    .filter((d) => d.favorability === 'favorable')
    .sort((a, b) => Number(b.yongshen) - Number(a.yongshen) || b.reasons.length - a.reasons.length)
    .slice(0, 4), [analysis]);

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
        showToast(`已取得經度 ${lon}°（僅此一次）`);
      },
      () => { setGpsStatus('GPS 遭拒；可手填經度'); showToast('GPS 遭拒；可手填經度'); },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  const person: Person | null = ls.persons.find((p) => p.id === settings.currentPersonId) ?? null;
  const camOn = camState === 'running';

  if (!settings.onboarded) {
    return <>
      <Onboarding
        onStart={() => {
          patchSettings({ onboarded: true });
          setTab('compass');
          autoCameraTried.current = true;
          void startCamera().then((ok) => showToast(ok ? '相機已開啟，實景背景使用中' : '相機未授權；仍可使用純盤，點右上「開啟相機」可重試'));
        }}
        onRequestCamera={async () => { const ok = await startCamera(); showToast(ok ? '相機已授權' : '相機未授權；仍可使用純盤'); }}
        onRequestSensor={async () => { const p = await heading.requestPermission(); showToast(p === 'granted' ? '方向權限已授權' : '可稍後手動校正方位'); }}
        cameraLabel={camState === 'running' ? '相機已開啟' : '允許相機'}
        sensorLabel={heading.permission === 'granted' ? '方向已授權' : '請求方向權限'}
      />
      <div className="scene-media" ref={videoHostRef} style={{ display: 'none' }} aria-hidden="true" />
      {toast && <div className="toast" role="status">{toast}</div>}
    </>;
  }

  return (
    <div className="app" ref={sceneRef}>
      {/* 圖層順序（由下而上）：純色底 → 相機影像 → 固定冷灰藍遮罩 → 上下漸層 → UI */}
      {!camOn && <div className="scene-fallback" aria-hidden="true" />}
      <div className="scene-media" ref={videoHostRef} aria-hidden="true" />
      <div className="scene-mask" aria-hidden="true" />
      <div className="scene-scrim top" aria-hidden="true" />
      <div className="scene-scrim bottom" aria-hidden="true" />

      <header className="brand-bar">
        <div className="brand-title">QiMenGFun <span>奇門吉方</span></div>
      </header>

      <TopInfoBar chart={chart} time={time} longitude={settings.longitude} gpsStatus={gpsStatus} />

      {tab === 'compass' && (
        <main className="compass-screen">
          <div className="dial-stage">
            <div className="compass-wrap" ref={dialWrapRef}>
              <QimenDial
                chart={chart} hasHeading={degree !== null}
                headingQuality={degree === null ? 'unavailable' : heading.state.quality}
                facing={stableSector}
                selected={selected} onSelect={(id) => { setSelected((cur) => (cur === id ? null : id)); }}
                assessment={analysis} reducedMotion={settings.reducedMotion || settings.powerSave}
              />
            </div>
            <div className="stage-chip heading-readout" aria-live="polite">
              <span>朝向</span><b>{degree === null ? '—' : `${degree.toFixed(0)}°`}</b>
              <small>{facingDirDef ? facingDirDef.name : degree === null ? '無感測' : '交界'}</small>
            </div>
            <div className="stage-actions">
              {!camOn && <button className="pill-btn" onClick={() => void startCamera()}>{camState === 'starting' ? '相機啟動中…' : '開啟相機'}</button>}
              {time.mode !== 'live' && <button className="pill-btn warn" onClick={() => controller.toLive(performance.now())}>預覽中 · 回到現在</button>}
            </div>
            <button className="round-btn left" onClick={() => setShowCalibration(true)} aria-label="校正方位"><span>⌖</span><i>校正</i></button>
            <button className="round-btn right primary" onClick={capture} aria-label="拍照"><span>◉</span><i>拍照</i></button>
          </div>

          <section className="focus-card glass" aria-label="方位解讀">
            <div className="focus-head">
              <div className="focus-title">
                {focusDef
                  ? <>{selected ? '已選' : '正對'} <b>{focusDef.short}</b><em>{focusDef.deg === null ? '中宮' : `${focusDef.deg}° ${focusDef.name}`}</em></>
                  : <span className="muted">對準想了解的方位，或點盤上宮位</span>}
              </div>
              <select className="event-select" value={event} onChange={(e) => patchSettings({ eventKind: e.target.value })} aria-label="事件類別">
                {EVENT_PROFILES.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>
            {focusPalace && focusDef ? (
              <>
                <div className="focus-main">
                  <span className={`verdict-badge ${TONE_CLASS[focusFav]}`}>{TONE_LABEL[focusFav]}</span>
                  <b>{focusPalace.door ?? '中宮'}</b>
                  <span>{focusPalace.stars.join('、') || '—'}</span>
                  <span>{focusPalace.deity ?? ''}</span>
                  <button className="link-btn" onClick={() => setDetailOpen(true)}>詳情 ›</button>
                </div>
                <p className="focus-reason">{focusAssess?.reasons.slice(0, 2).join('；') || (focusFav === 'unknown' ? '尚無足夠依據，不給吉凶判斷。' : '')}</p>
              </>
            ) : null}
            <div className="good-row">
              <span className="good-label">吉方</span>
              <button className="info-btn" onClick={() => setShowLegend(true)} aria-label="綠色代表什麼">?</button>
              <div className="good-chips">
                {goodDirs.length === 0
                  ? <span className="muted">此刻沒有明確吉方（{eventLabel}）</span>
                  : goodDirs.map((d) => {
                    const def = PALACES.find((p) => p.id === d.palaceId)!;
                    const pal = chart?.palaces.find((p) => p.id === d.palaceId);
                    const prof = EVENT_PROFILES.find((e) => e.id === event)!;
                    const why = pal ? yongshenOf(pal, prof).join('＋') : '';
                    return <button key={d.palaceId} className={`chip ${selected === d.palaceId ? 'on' : ''}`} onClick={() => setSelected(d.palaceId as PalaceId)}>{def.name}{def.deg === null ? '' : ` ${def.deg}°`} · {why}</button>;
                  })}
              </div>
            </div>
          </section>
        </main>
      )}

      {tab === 'compass' && detailOpen && focusId && (
        <PalaceCard chart={chart} palaceId={focusId} assessment={analysis}
          eventLabel={eventLabel} heading={degree} expanded onExpand={() => setDetailOpen(false)}
          onClose={() => setDetailOpen(false)} onSelect={(id) => setSelected(id as PalaceId)} />
      )}

      {tab !== 'compass' && (
        <main className="panel-host">
          <div className="panel-head">
            <button className="icon-btn" onClick={() => setTab('compass')} aria-label="返回羅盤">←</button>
            <h1>{TABS.find((t) => t.id === tab)?.label}</h1>
          </div>
          {tab === 'analysis' && <AnalysisPanel chart={chart} analysis={analysis} event={event}
            onEvent={(e) => patchSettings({ eventKind: e })} person={person} selected={selected}
            onSelect={(id) => { setSelected(id); setTab('compass'); }} onToast={showToast} />}
          {tab === 'time' && <TimePanel time={time} event={event} onEvent={(e) => patchSettings({ eventKind: e })}
            onSetInstant={(ms) => controller.setInstant(ms, performance.now())}
            onNow={() => controller.toLive(performance.now())}
            onJump={(ms) => { controller.setInstant(ms, performance.now()); setTab('compass'); }}
            onSetBasis={(b) => patchSettings({ basis: b })} onSetLongitude={(lon) => patchSettings({ longitude: lon })}
            onRequestGps={requestGps} gpsStatus={gpsStatus} onToast={showToast} />}
          {tab === 'records' && <RecordsPanel records={records} urls={urls} onView={setDetail}
            onDelete={async (r) => { await deleteRecord(r.id); if (r.photoId) await deletePhoto(r.photoId); await refreshRecords(); showToast('已刪除'); }} onToast={showToast} />}
          {tab === 'tools' && <ToolsPanel settings={settings} persons={ls.persons} storage={storage}
            onSettings={patchSettings}
            onAddPerson={(p) => setLs((prev) => { const next = { ...prev, persons: [...prev.persons, p], settings: { ...prev.settings, currentPersonId: p.id } }; saveLS(next); return next; })}
            onUpdatePerson={(p) => setLs((prev) => { const next = { ...prev, persons: prev.persons.map((x) => x.id === p.id ? p : x) }; saveLS(next); return next; })}
            onDeletePerson={(id) => setLs((prev) => { const next = { ...prev, persons: prev.persons.filter((x) => x.id !== id), settings: { ...prev.settings, currentPersonId: prev.settings.currentPersonId === id ? null : prev.settings.currentPersonId } }; saveLS(next); return next; })}
            onSelectPerson={(id) => patchSettings({ currentPersonId: id })}
            onCalibrate={() => setShowCalibration(true)} onRequestSensor={async () => { const p = await heading.requestPermission(); showToast(p === 'granted' ? '方向權限已授權' : '可手動校正'); }}
            onToast={showToast} />}
        </main>
      )}

      <nav className="tabbar" aria-label="主分頁">
        {TABS.map((t) => (
          <button key={t.id} className={`tab ${tab === t.id ? 'on' : ''}`} onClick={() => { setTab(t.id); setDetailOpen(false); }} aria-current={tab === t.id ? 'page' : undefined}>
            <span className="tab-icon">{t.icon}</span><span>{t.label}</span>
          </button>
        ))}
      </nav>

      {showLegend && (() => {
        const prof = EVENT_PROFILES.find((e) => e.id === event)!;
        return (
          <div className="modal-backdrop" onClick={() => setShowLegend(false)}>
            <div className="modal glass" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="顏色說明">
              <h2>綠色是什麼意思？</h2>
              <p className="hint">盤面上的顏色，是依你選的事件「<b>{prof.label}</b>」來判斷的：</p>
              <ul className="legend-list">
                <li><i className="lg lg-good" /><div><b>綠色（宜）</b><span>出現「{prof.label}」要找的取用神，而且沒有凶象。</span></div></li>
                <li><i className="lg lg-mixed" /><div><b>黃色（吉凶並見）</b><span>有取用神，但同時也有凶象，要自己斟酌。</span></div></li>
                <li><i className="lg lg-bad" /><div><b>紅色（宜慎）</b><span>只有凶象，沒有取用神。</span></div></li>
                <li><i className="lg lg-plain" /><div><b>無色（平）</b><span>沒有明顯的吉凶象意。</span></div></li>
              </ul>
              <p className="hint"><b>{prof.label}的取用神：</b>{[...prof.favoredDoors, ...prof.favoredStars, ...prof.favoredMarkers].join('、')}。<br /><b>凶象：</b>死門、驚門、天蓬、天芮、天柱、白虎、玄武、螣蛇、旬空。</p>
              <p className="hint">所以換一個事件，綠色的位置就會跟著變；同一事件，不同時間也會因為盤局改變而落在不同的門。這是依傳統象意整理的參考，不是預測。</p>
              <button className="btn primary" onClick={() => setShowLegend(false)}>知道了</button>
            </div>
          </div>
        );
      })()}

      {showCalibration && (
        <div className="modal-backdrop" onClick={() => setShowCalibration(false)}>
          <div className="modal glass" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="方位校正">
            <h2>校正方位</h2>
            <p className="hint">把手機鏡頭對準你<b>已知的方位</b>（例如用另一個指南針確認），再點下面對應的方位，讓盤面與真實一致。偏移只保存於本次使用。</p>
            <div className="calibrate-grid">
              {DIRECTIONS.map((d) => <button key={d.deg} className="btn" onClick={() => { heading.calibrateTo(d.deg); setShowCalibration(false); showToast(`已校正：目前正對${d.name}`); }}>{d.name}</button>)}
            </div>
            <button className="btn" onClick={() => { heading.setManualOffsetDeg(0); setShowCalibration(false); showToast('已重設校正'); }}>重設校正</button>
          </div>
        </div>
      )}

      {detail && (
        <div className="modal-backdrop" onClick={() => setDetail(null)}>
          <div className="modal glass detail-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="紀錄詳情">
            <h2>{detail.title || '紀錄詳情'}</h2>
            {detail.photoId && urls.get(detail.photoId) && <img className="detail-photo" src={urls.get(detail.photoId)} alt={detail.title} />}
            <div className="hint">拍攝 {new Date(detail.capturedAt).toLocaleString('zh-Hant')} · 盤局時刻 {new Date(detail.chartInstant).toLocaleString('zh-Hant')} {detail.simulated ? '（模擬時間）' : ''}</div>
            <div className="hint">盤局 {detail.chart?.term ?? '—'} · {detail.chart?.dun === 'yang' ? '陽遁' : '陰遁'}{detail.chart?.ju ?? '—'}局</div>
            <button className="btn" onClick={() => setDetail(null)}>關閉</button>
          </div>
        </div>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
