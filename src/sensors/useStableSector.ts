/**
 * 遲滯穩定後的扇區：避免相機朝向在兩扇區交界附近抖動時，吉凶紅綠快速閃爍。
 *
 * - 遲滯只負責「顯示穩定」，不改寫測量值；交界提示（距邊界 ≤2°）仍照常顯示，
 *   因此「已越界但被遲滯留在原扇區」不會被默默當成準確結果（遲滯 1.5° < 提示 2°）。
 * - frozen=true（鏡頭朝天／地、感測中斷等不可靠狀態）時凍結，暫停決定性的吉凶更新。
 */
import { useRef } from "react";
import { SectorHysteresis } from "../domain/compass/heading";
import type { DirectionDeg } from "../domain/compass/directions";

export const SECTOR_HYSTERESIS_DEG = 1.5;

export function useStableSector(heading: number | null, frozen: boolean): DirectionDeg | null {
  const ref = useRef<SectorHysteresis | null>(null);
  if (ref.current === null) ref.current = new SectorHysteresis(SECTOR_HYSTERESIS_DEG);
  const h = ref.current;

  // 以下對相同輸入是冪等的（React 嚴格模式重複渲染也安全）
  if (heading === null) {
    h.reset();
    return null;
  }
  if (frozen && h.get() !== null) return h.get();
  return h.update(heading).sector;
}
