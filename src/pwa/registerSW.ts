/**
 * Service Worker 註冊與版本更新（vite-plugin-pwa）。
 *
 * 採用 registerType: "autoUpdate"：新版 SW 在背景下載、快取完成後，
 * 由 SW 自己 skipWaiting + clientsClaim 接管，外掛的 activated 事件再自動 reload。
 *
 * 為什麼不用 "prompt" + 頁面上一個「更新」按鈕：
 *   舊寫法只呼叫 location.reload()，但新版 SW 還卡在 waiting，重載後仍是舊版，
 *   提示一直重複出現，使用者得手動刷好幾次。更麻煩的是「先有雞還是先有蛋」——
 *   已卡在舊版提示的使用者，點按鈕跑的還是舊邏輯，修正版永遠輪不到生效。
 *   autoUpdate 把更新動作放在 SW 端，連還沒更新的舊頁面也會被新 SW 接管並重載，
 *   不需要依賴頁面上的任何按鈕。它不是「每次進頁面就強制換頁」：只有在新版
 *   已完整下載快取好之後才更新一次。
 */
import { registerSW } from "virtual:pwa-register";

let forceUpdate: (() => Promise<void>) | null = null;

export function registerSWWithUpdatePrompt(): void {
  const update = registerSW({
    onNeedRefresh() {
      // autoUpdate 模式下理論上不會觸發；保留為保險：若真的出現，立刻更新，不讓舊提示卡住使用者
      void update();
    },
    onOfflineReady() {
      console.info("[BaziGFun] 離線快取完成，可離線使用");
    },
  });
  forceUpdate = update;
}

/** 手動強制更新（供未來需要時使用；autoUpdate 下通常不需呼叫） */
export function requestUpdate(): Promise<void> {
  return forceUpdate ? forceUpdate() : Promise.resolve();
}

export { registerSW };
