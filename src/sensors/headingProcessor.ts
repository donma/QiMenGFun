/**
 * 感測樣本 → HeadingState 的純邏輯（不依賴 DOM，可單元測試）。
 *
 * 規則（對應規格第 6 節）：
 * - 保留 rawHeading（未平滑）；displayHeading 為濾波後再加人工偏移，平滑不改寫原始測量。
 * - 以姿態幾何換算相機水平朝向；鏡頭近垂直時標示退化，不硬給一個不可靠的數字。
 * - 資料語義明確區分（iOS 指南針／絕對歐拉角／相對歐拉角），相對方位一律「不可信，需校正」。
 */
import type { OrientationSample } from "./deviceOrientation";
import { BOUNDARY_WARN_DEG } from "../domain/compass/directions";
import {
  CircularLowPass,
  boundaryDistanceDeg,
  cameraElevationDeg,
  cameraHeadingFromEuler,
  isCameraNearVertical,
  normalizeDeg,
  type HeadingSemantic,
  type HeadingState,
  type NorthReference,
  type Quality,
} from "../domain/compass/heading";

/** iOS webkitCompassAccuracy 超過此值（度）視為精度不足 */
export const WEBKIT_ACCURACY_OK_DEG = 30;

export function initialHeadingState(northReference: NorthReference = "magnetic"): HeadingState {
  return {
    rawHeading: null,
    displayHeading: null,
    cameraAzimuth: null,
    northReference,
    source: "sensor",
    quality: "unavailable",
    semantic: null,
    boundaryDistance: null,
    nearBoundary: false,
    tiltDegraded: false,
    elevation: null,
    pitch: null,
    roll: null,
  };
}

export interface ResolvedHeading {
  /** 原始相機水平朝向；鏡頭近垂直無法換算時為 null */
  raw: number | null;
  semantic: HeadingSemantic | null;
  /** iOS 回報的精度（度）；其他來源為 null */
  accuracy: number | null;
}

/** 依事件內容決定使用哪一種來源，並換算成原始水平朝向 */
export function resolveHeading(s: OrientationSample): ResolvedHeading {
  if (s.webkitHeading !== null) {
    return { raw: normalizeDeg(s.webkitHeading), semantic: "webkit-compass", accuracy: s.webkitAccuracy };
  }
  if (s.alpha !== null && s.beta !== null && s.gamma !== null) {
    return {
      raw: cameraHeadingFromEuler(s.alpha, s.beta, s.gamma),
      semantic: s.absolute ? "absolute-euler" : "relative-euler",
      accuracy: null,
    };
  }
  return { raw: null, semantic: null, accuracy: null };
}

export class HeadingProcessor {
  private filter = new CircularLowPass(0.22);

  /** 濾波後、尚未加人工偏移的方位（校正用） */
  get filtered(): number | null {
    return this.filter.get();
  }

  reset(): void {
    this.filter.reset();
  }

  process(s: OrientationSample, offsetDeg: number, northReference: NorthReference): HeadingState {
    const { raw, semantic, accuracy } = resolveHeading(s);
    const elevation = s.beta !== null && s.gamma !== null ? cameraElevationDeg(s.beta, s.gamma) : null;
    const tiltDegraded = elevation !== null && isCameraNearVertical(elevation);

    // 近垂直無法換算水平朝向時，不更新濾波器（保留最後有效值），避免把亂數塞進濾波
    const filtered = raw !== null ? this.filter.push(raw) : this.filter.get();
    const display = filtered === null ? null : normalizeDeg(filtered + offsetDeg);

    let quality: Quality;
    if (display === null) quality = "unavailable";
    else if (tiltDegraded || semantic === "relative-euler") quality = "uncertain";
    else if (semantic === "webkit-compass") {
      quality = accuracy !== null && (accuracy < 0 || accuracy > WEBKIT_ACCURACY_OK_DEG) ? "uncertain" : "valid";
    } else quality = "valid";

    const bd = display === null ? null : boundaryDistanceDeg(display);
    return {
      rawHeading: raw,
      displayHeading: display,
      cameraAzimuth: tiltDegraded ? null : display,
      northReference,
      source: "sensor",
      quality,
      semantic,
      boundaryDistance: bd,
      nearBoundary: bd !== null && bd <= BOUNDARY_WARN_DEG,
      tiltDegraded,
      elevation,
      pitch: s.beta,
      roll: s.gamma,
    };
  }
}
