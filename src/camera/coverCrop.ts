/**
 * 與畫面一致的裁切計算（純函式，可單元測試）。
 *
 * 相機畫面在螢幕上是 object-fit: cover：等比例放大到「完全覆蓋」可視區，超出的部分置中裁掉。
 * 拍照時必須用同一條規則由 video 取出可見區域，照片才會和螢幕所見相符。
 */
export interface CoverCrop {
  /** 在 video 原生像素座標中的可見區域 */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  /** video 像素 → 螢幕 CSS px 的放大倍率 */
  scale: number;
}

export function computeCoverCrop(videoW: number, videoH: number, viewW: number, viewH: number): CoverCrop {
  const scale = Math.max(viewW / videoW, viewH / videoH);
  const sw = viewW / scale;
  const sh = viewH / scale;
  return { sx: (videoW - sw) / 2, sy: (videoH - sh) / 2, sw, sh, scale };
}
