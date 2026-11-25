/**
 * 方位引擎：角度正規化、圓形濾波、遲滯、扇區分類、退化狀態。
 * 純函式，可完整單元測試。
 */

import { DIRECTIONS, sectorCenterDeg, boundaryDistanceDegImpl, BOUNDARY_WARN_DEG, type DirectionDeg } from "./directions";

export type NorthReference = "magnetic" | "true";
export type HeadingSource = "sensor" | "manual";
export type Quality = "valid" | "uncertain" | "unavailable";

/**
 * 方位資料來源語義：
 * - webkit-compass：iOS `webkitCompassHeading`（磁北；直立時視為鏡頭朝向，**需實機標定**）
 * - absolute-euler：`deviceorientationabsolute`／absolute=true 的歐拉角，經姿態幾何換算（磁北）
 * - relative-euler：相對任意起點的歐拉角（非絕對方位，必須人工校正才有意義）
 */
export type HeadingSemantic = "webkit-compass" | "absolute-euler" | "relative-euler";

export interface HeadingState {
  /** 原始測量值（未平滑），度 0–360 */
  rawHeading: number | null;
  /** 平滑顯示值，度 0–360 */
  displayHeading: number | null;
  /** 相機水平朝向（若鏡頭非水平投影退化則 null） */
  cameraAzimuth: number | null;
  northReference: NorthReference;
  source: HeadingSource;
  quality: Quality;
  /** 資料語義；null＝尚無樣本 */
  semantic: HeadingSemantic | null;
  /** 距最近扇區邊界的角度 */
  boundaryDistance: number | null;
  /** 距邊界過近，吉凶交界提示 */
  nearBoundary: boolean;
  /** 水平投影退化（鏡頭近垂直朝天/地） */
  tiltDegraded: boolean;
  /** 鏡頭仰角（度，0=水平，+90=朝天，−90=朝地） */
  elevation: number | null;
  /** beta／gamma 原始值（診斷用） */
  pitch: number | null;
  roll: number | null;
}

/** 角度正規化至 0–360 */
export function normalizeDeg(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** 兩角度最短角差（-180..180） */
export function shortestAngleDiff(a: number, b: number): number {
  let d = normalizeDeg(a - b);
  if (d > 180) d -= 360;
  return d;
}

/** 圓形插值（最短角路徑） */
export function circularLerp(from: number, to: number, t: number): number {
  return normalizeDeg(from + shortestAngleDiff(to, from) * t);
}

/** 一階低通圓形濾波器 */
export class CircularLowPass {
  private value: number | null = null;
  constructor(private alpha: number) {}
  push(raw: number): number {
    if (this.value === null) {
      this.value = normalizeDeg(raw);
    } else {
      this.value = circularLerp(this.value, raw, this.alpha);
    }
    return this.value;
  }
  reset(): void {
    this.value = null;
  }
  get(): number | null {
    return this.value;
  }
}

/**
 * 吉凶遲滯器：避免 UI 在兩扇區交界附近閃爍。
 *
 * 判定依據是「角度離目前顯示扇區中心多遠」：仍在 22.5° ＋ 遲滯帶內就保持原扇區；
 * 超出才切換。這樣
 * - 交界附近小幅抖動不會閃爍（只在越過遲滯帶後才切換，回頭也一樣）；
 * - 一次跨好幾個扇區的快速轉動（掉幀、甩動）會立即切到正確扇區，
 *   不會因為「新角度剛好靠近它自己扇區的邊界」而錯誤留在很遠的舊扇區。
 */
export class SectorHysteresis {
  private current: DirectionDeg | null = null;
  constructor(private hysteresisDeg = 1.5) {}

  update(heading: number): { sector: DirectionDeg | null; changed: boolean } {
    const raw = sectorCenterDeg(heading);
    if (raw === null) return { sector: this.current, changed: false };
    if (this.current === null) {
      this.current = raw;
      return { sector: raw, changed: true };
    }
    if (raw === this.current) return { sector: this.current, changed: false };
    // 仍在目前扇區（含遲滯帶）內 → 保持；UI 另會顯示「接近交界」提示，不默默偽裝成已確定
    if (Math.abs(shortestAngleDiff(heading, this.current)) <= 22.5 + this.hysteresisDeg) {
      return { sector: this.current, changed: false };
    }
    this.current = raw;
    return { sector: raw, changed: true };
  }
  reset(): void {
    this.current = null;
  }
  get(): DirectionDeg | null {
    return this.current;
  }
}

/** 距扇區邊界的角距離（重新導出供本模組與 UI 使用） */
export function boundaryDistanceDeg(deg: number): number {
  return boundaryDistanceDegImpl(deg);
}

const D2R = Math.PI / 180;

/**
 * 後置鏡頭視線向量（地球座標：x=東、y=北、z=上）。
 * 依 W3C DeviceOrientation 旋轉順序 R = Rz(α)·Rx(β)·Ry(γ)；
 * 裝置 z 軸（垂直螢幕朝向使用者）在地球座標為 R·ẑ，後置鏡頭看向其反方向。
 * 此向量與螢幕轉向（直式／橫式）無關，因為鏡頭固定在機身上。
 */
export function cameraLookVector(alphaDeg: number, betaDeg: number, gammaDeg: number): { x: number; y: number; z: number } {
  const a = alphaDeg * D2R;
  const b = betaDeg * D2R;
  const g = gammaDeg * D2R;
  const zx = Math.sin(g) * Math.cos(a) + Math.cos(g) * Math.sin(b) * Math.sin(a);
  const zy = Math.sin(g) * Math.sin(a) - Math.cos(g) * Math.sin(b) * Math.cos(a);
  const zz = Math.cos(g) * Math.cos(b);
  return { x: -zx, y: -zy, z: -zz };
}

/** 鏡頭仰角（度）：0＝水平，+90＝正上方，−90＝正下方。只需 beta/gamma。 */
export function cameraElevationDeg(betaDeg: number, gammaDeg: number): number {
  const up = -Math.cos(betaDeg * D2R) * Math.cos(gammaDeg * D2R);
  return Math.asin(Math.max(-1, Math.min(1, up))) / D2R;
}

/**
 * 由歐拉角換算相機「水平朝向」（順時針自北，0–360）。
 * 鏡頭近乎垂直（水平投影過短）時回傳 null，不硬給一個不可靠的數字。
 */
export function cameraHeadingFromEuler(alphaDeg: number, betaDeg: number, gammaDeg: number): number | null {
  const v = cameraLookVector(alphaDeg, betaDeg, gammaDeg);
  if (Math.hypot(v.x, v.y) < 1e-3) return null;
  return normalizeDeg(Math.atan2(v.x, v.y) / D2R);
}

/** 鏡頭仰角超過此值（度）視為朝天／朝地，水平朝向不可靠 */
export const TILT_DEGRADED_ELEVATION_DEG = 65;

/** 鏡頭近垂直（朝天或朝地）時水平投影退化；橫式握持（gamma≈±90）不應被誤判 */
export function isCameraNearVertical(elevationDeg: number): boolean {
  return Math.abs(elevationDeg) > TILT_DEGRADED_ELEVATION_DEG;
}

/** 磁北 ↔ 真北換算（declination = 真北 - 磁北，東偏為正） */
export function applyDeclination(headingDeg: number, declinationDeg: number): number {
  return normalizeDeg(headingDeg + declinationDeg);
}

export interface DirectionalReading {
  deg: number;
  palace: string;
  branch: string;
  label: string | null;
  nearBoundary: boolean;
}

/** 由角度得到方位閱讀（宮位、盤面摘要、交界提示）。 */
export function directionalReading(
  deg: number,
  labelFn: (deg: DirectionDeg) => string,
): DirectionalReading {
  const sector = sectorCenterDeg(deg);
  const bd = boundaryDistanceDeg(deg);
  const p = DIRECTIONS.find((x) => x.deg === sector);
  return {
    deg: normalizeDeg(deg),
    palace: p?.short ?? "—",
    branch: p?.branch ?? "—",
    label: sector !== null ? labelFn(sector) : null,
    nearBoundary: bd <= BOUNDARY_WARN_DEG,
  };
}
