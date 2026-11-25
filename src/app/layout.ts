/**
 * 版面判斷：什麼情況下分析面板是「右側／下方常駐」而非「底部抽屜」。
 *
 * 這組條件必須與 src/styles/screen.css、src/styles/panels.css 內的 @media 完全一致
 * （layout.test.ts 會檢查兩邊沒有漂移）。
 *
 * - 寬度 ≥920 且高度夠（>600）：平板、桌機。
 * - 寬度 ≥1140：連短螢幕（橫式資訊欄＋側欄）也放得下。
 * - 920–1139 的短螢幕（例如 iPhone Pro Max 橫式 932×430）不用側欄，改用抽屜，
 *   否則羅盤會被擠到只剩幾 px。
 * - 摺疊雙螢幕（CSS Viewport Segments）：一個螢幕放羅盤、另一個放分析面板，內容不跨鉸鏈。
 */
export const SIDE_PANEL_MEDIA_PARTS = [
  "(min-width: 920px) and (min-height: 601px)",
  "(min-width: 1140px)",
  "(horizontal-viewport-segments: 2)",
  "(vertical-viewport-segments: 2)",
] as const;

export const SIDE_PANEL_QUERY = SIDE_PANEL_MEDIA_PARTS.join(", ");

/** 目前是否為「分析面板常駐」的版面（此時抽屜被隱藏，不應把抽屜標成開啟） */
export function hasPersistentSidePanel(): boolean {
  return typeof window !== "undefined" && window.matchMedia(SIDE_PANEL_QUERY).matches;
}
