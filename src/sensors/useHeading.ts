/**
 * 方位感測 React hook：訂閱方向事件 → HeadingProcessor → rAF 合併更新。
 *
 * - 感測事件可達 60Hz；以 requestAnimationFrame 合併，每幀最多更新一次畫面。
 * - 人工偏移存於 ref（在濾波之後套用），校正按鈕立即生效；偏移只存在本次執行，不跨次保存
 *   （偏移依裝置與周遭磁場而異，沿用舊偏移可能默默造成錯誤方位）。
 * - 一段時間沒有樣本即標為 unavailable（見 staleLimitMs），不把過期數字當成即時量測。
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeOrientation, requestOrientationPermission, type SensorPermission } from "./deviceOrientation";
import { HeadingProcessor, initialHeadingState } from "./headingProcessor";
import { normalizeDeg, type HeadingSemantic, type HeadingState, type NorthReference } from "../domain/compass/heading";

/**
 * 多久沒有新資料就判定感測中斷。
 * - iOS 的 webkitCompassHeading 以固定頻率持續送出，沉默＝真的中斷 → 3 秒。
 * - 其他來源（Chrome 的歐拉角事件）只在姿態改變超過約 0.1° 才送；手機靜止放在桌上量測時
 *   可能長時間沒有新事件，不能因此誤報感測中斷（會連帶停用拍照）→ 20 秒。
 */
export function staleLimitMs(semantic: HeadingSemantic | null): number {
  return semantic === "webkit-compass" ? 3000 : 20000;
}

export interface UseHeadingResult {
  state: HeadingState;
  permission: SensorPermission;
  requestPermission: () => Promise<SensorPermission>;
  /** 每秒收到的樣本數（診斷） */
  sampleRate: number;
  /** 目前套用的人工偏移（度） */
  manualOffsetDeg: number;
  setManualOffsetDeg: (d: number) => void;
  /** 以已知方位校正：讓目前顯示值等於 targetDeg。無即時資料時回傳 false */
  calibrateTo: (targetDeg: number) => boolean;
}

export function useHeading(enabled: boolean, northReference: NorthReference = "magnetic"): UseHeadingResult {
  const [state, setState] = useState<HeadingState>(() => initialHeadingState(northReference));
  const [permission, setPermission] = useState<SensorPermission>("prompt");
  const [sampleRate, setSampleRate] = useState(0);
  const [manualOffsetDeg, setOffsetState] = useState(0);

  const processor = useRef(new HeadingProcessor());
  const offsetRef = useRef(0);
  const northRef = useRef(northReference);
  const pending = useRef<HeadingState | null>(null);
  const raf = useRef(0);
  const lastSampleTs = useRef(0);
  const semanticRef = useRef<HeadingSemantic | null>(null);
  const count = useRef(0);

  northRef.current = northReference;

  const setManualOffsetDeg = useCallback((d: number) => {
    const v = normalizeDeg(d);
    offsetRef.current = v;
    setOffsetState(v);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    // 重新啟用時丟棄舊濾波值與舊狀態，避免顯示過期方位
    processor.current.reset();
    lastSampleTs.current = 0;
    semanticRef.current = null;
    setState(initialHeadingState(northRef.current));

    const flush = () => {
      raf.current = 0;
      const next = pending.current;
      pending.current = null;
      if (next) setState(next);
    };

    const unsubscribe = subscribeOrientation((s) => {
      lastSampleTs.current = Date.now();
      count.current++;
      const next = processor.current.process(s, offsetRef.current, northRef.current);
      semanticRef.current = next.semantic;
      pending.current = next;
      if (!raf.current) raf.current = requestAnimationFrame(flush);
    });

    const timer = setInterval(() => {
      setSampleRate(count.current);
      count.current = 0;
      if (lastSampleTs.current && Date.now() - lastSampleTs.current > staleLimitMs(semanticRef.current)) {
        setState((prev) => (prev.quality === "unavailable" ? prev : { ...prev, quality: "unavailable" }));
      }
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(timer);
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = 0;
      pending.current = null;
    };
  }, [enabled]);

  useEffect(() => {
    setState((prev) => (prev.northReference === northReference ? prev : { ...prev, northReference }));
  }, [northReference]);

  const requestPermission = useCallback(async () => {
    const res = await requestOrientationPermission();
    setPermission(res);
    return res;
  }, []);

  const calibrateTo = useCallback((targetDeg: number) => {
    const live = processor.current.filtered;
    const fresh = lastSampleTs.current > 0 && Date.now() - lastSampleTs.current <= staleLimitMs(semanticRef.current);
    if (live === null || !fresh) return false;
    setManualOffsetDeg(normalizeDeg(targetDeg) - live);
    return true;
  }, [setManualOffsetDeg]);

  return { state, permission, requestPermission, sampleRate, manualOffsetDeg, setManualOffsetDeg, calibrateTo };
}
