/**
 * DeviceOrientation adapter：能力偵測、iOS 權限、事件解讀。
 * 不假設 webkitCompassHeading 一定存在或語義正確——以存在性與實測標定為前提。
 */

export interface OrientationSample {
  /** iOS `webkitCompassHeading`（磁北，度）；不存在時為 null */
  webkitHeading: number | null;
  /** `webkitCompassAccuracy`（度，越小越準；負值＝無效） */
  webkitAccuracy: number | null;
  alpha: number | null;
  beta: number | null;
  gamma: number | null;
  /** 此事件的 alpha/beta/gamma 是否為相對地球的絕對方位（deviceorientationabsolute 或 event.absolute） */
  absolute: boolean;
  /** 事件來源 */
  eventType: "deviceorientation" | "deviceorientationabsolute";
  /** 螢幕方向角（0/90/180/270），僅供診斷；相機朝向換算不依賴它 */
  screenOrientation: number;
  timestamp: number;
}

export type SensorPermission = "granted" | "denied" | "prompt" | "unsupported";

export interface SensorCapabilities {
  hasDeviceOrientation: boolean;
  hasAbsoluteEvent: boolean; // Chrome Android 的 deviceorientationabsolute
  hasRequestPermission: boolean; // iOS 13+ DeviceOrientationEvent.requestPermission
  isIOS: boolean;
  isSecureContext: boolean;
}

type DOEStatic = {
  requestPermission?: () => Promise<"granted" | "denied">;
};

function doeStatic(): DOEStatic | undefined {
  return (window as unknown as { DeviceOrientationEvent?: DOEStatic }).DeviceOrientationEvent;
}

export function detectCapabilities(): SensorCapabilities {
  const DOE = doeStatic();
  return {
    hasDeviceOrientation: typeof DOE !== "undefined",
    hasAbsoluteEvent: "ondeviceorientationabsolute" in window,
    hasRequestPermission: typeof DOE !== "undefined" && typeof DOE.requestPermission === "function",
    isIOS:
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform ?? "")),
    isSecureContext: window.isSecureContext,
  };
}

/** 請求方向感測器權限（iOS 13+ 必須在使用者手勢中呼叫） */
export async function requestOrientationPermission(): Promise<SensorPermission> {
  const DOE = doeStatic();
  if (typeof DOE === "undefined") return "unsupported";
  if (typeof DOE.requestPermission !== "function") {
    // 非 iOS 13+：不需要權限，直接監聽
    return "granted";
  }
  try {
    const res = await DOE.requestPermission();
    return res === "granted" ? "granted" : "denied";
  } catch {
    return "denied";
  }
}

function screenAngle(): number {
  if (typeof screen !== "undefined" && screen.orientation && typeof screen.orientation.angle === "number") {
    return screen.orientation.angle;
  }
  const legacy = (window as unknown as { orientation?: number }).orientation;
  return typeof legacy === "number" ? legacy : 0;
}

function num(v: number | null | undefined): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** 解讀 DeviceOrientationEvent → 樣本 */
export function parseOrientationEvent(e: DeviceOrientationEvent, eventType: OrientationSample["eventType"]): OrientationSample {
  const w = e as DeviceOrientationEvent & {
    webkitCompassHeading?: number;
    webkitCompassAccuracy?: number;
  };
  return {
    webkitHeading: num(w.webkitCompassHeading),
    webkitAccuracy: num(w.webkitCompassAccuracy),
    alpha: num(e.alpha),
    beta: num(e.beta),
    gamma: num(e.gamma),
    absolute: eventType === "deviceorientationabsolute" || e.absolute === true,
    eventType,
    screenOrientation: screenAngle(),
    timestamp: Date.now(),
  };
}

/**
 * 訂閱方向事件。若瀏覽器提供 deviceorientationabsolute（Chrome Android），
 * 一併訂閱；同時有絕對事件流時忽略相對事件，避免兩種語義互相覆蓋。
 */
export function subscribeOrientation(cb: (s: OrientationSample) => void): () => void {
  let lastAbsoluteTs = 0;

  const onRelative = (e: DeviceOrientationEvent) => {
    const s = parseOrientationEvent(e, "deviceorientation");
    // iOS：webkitCompassHeading 仍來自此事件，不可忽略
    if (!s.absolute && s.webkitHeading === null && Date.now() - lastAbsoluteTs < 1500) return;
    cb(s);
  };
  const onAbsolute = (e: DeviceOrientationEvent) => {
    lastAbsoluteTs = Date.now();
    cb(parseOrientationEvent(e, "deviceorientationabsolute"));
  };

  window.addEventListener("deviceorientation", onRelative, true);
  const hasAbs = "ondeviceorientationabsolute" in window;
  if (hasAbs) window.addEventListener("deviceorientationabsolute", onAbsolute as EventListener, true);
  return () => {
    window.removeEventListener("deviceorientation", onRelative, true);
    if (hasAbs) window.removeEventListener("deviceorientationabsolute", onAbsolute as EventListener, true);
  };
}
