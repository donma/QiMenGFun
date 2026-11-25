/** 八方位幾何：北 0°、東 90°，順時針。與九宮固定方位一致。 */
import { PALACES } from '../qimen/tables';
import type { PalaceId } from '../qimen/types';

export type DirectionDeg = 0 | 45 | 90 | 135 | 180 | 225 | 270 | 315;

export interface DirectionDef {
  deg: DirectionDeg;
  name: string;
  short: string;
  branch: string;
  palaceId: PalaceId;
}

export const DIRECTIONS: readonly DirectionDef[] = [0, 45, 90, 135, 180, 225, 270, 315].map((deg) => {
  const p = PALACES.find((x) => x.deg === deg)!;
  return { deg: deg as DirectionDeg, name: p.name, short: p.short, branch: p.branches.join(''), palaceId: p.id };
});

export const BOUNDARY_WARN_DEG = 2;

/** 角度 → 最接近的方位中心（；交界 ±1.5° 內回傳 null）。 */
export function sectorCenterDeg(deg: number): DirectionDeg | null {
  const d = ((deg % 360) + 360) % 360;
  const nearest = Math.round(d / 45) * 45 % 360;
  const distance = Math.abs(((d - nearest + 540) % 360) - 180);
  return distance <= 22.5 - BOUNDARY_WARN_DEG ? (nearest as DirectionDeg) : null;
}

/** 距最近方位邊界的角度（0..22.5）。 */
export function boundaryDistanceDegImpl(deg: number): number {
  const d = ((deg % 360) + 360) % 360;
  const nearest = Math.round(d / 45) * 45 % 360;
  const toCenter = Math.abs(((d - nearest + 540) % 360) - 180);
  return 22.5 - toCenter;
}

export function directionAt(deg: number): DirectionDef {
  const d = ((deg % 360) + 360) % 360;
  const idx = Math.round(d / 45) % 8;
  return DIRECTIONS[idx] ?? DIRECTIONS[0]!;
}
