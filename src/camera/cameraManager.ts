/**
 * 相機管理：getUserMedia、啟停、拍照幀擷取。
 * 僅使用後置鏡頭（environment）；不假設一定成功，錯誤完整上拋。
 *
 * 生命週期的幾個保證（對應真機會遇到的情況）：
 * - start() 進行中再呼叫 start()：共用同一次啟動，不會開第二個串流。
 * - start() 還在等授權／開鏡頭時被 stop()（例如使用者馬上切到別的 App）：鏡頭一取得就立刻關閉，
 *   不會在背景偷偷開著相機；此時 start() 回傳 false。
 * - 串流被外力結束（被其他 App 搶走、裝置中斷）：狀態轉為 "ended"，並呼叫 onEnded，
 *   讓介面不要在一張死掉的畫面上繼續標示「相機✓」。
 */

export type CameraState = "idle" | "starting" | "running" | "failed" | "denied" | "ended";

export interface CameraManager {
  /** 回傳 true＝已在播放；false＝啟動途中被 stop() 取消（狀態維持 idle） */
  start(): Promise<boolean>;
  stop(): void;
  /** 擷取當前幀到 canvas（以 video 原生解析度） */
  captureFrame(): HTMLCanvasElement | null;
  video: HTMLVideoElement | null;
  state: CameraState;
  /** 串流自己結束時通知（主動 stop() 不會觸發） */
  onEnded: (() => void) | null;
}

export function createCameraManager(): CameraManager {
  let stream: MediaStream | null = null;
  const video = document.createElement("video");
  video.setAttribute("playsinline", "true");
  video.setAttribute("autoplay", "true");
  video.muted = true;
  let state: CameraState = "idle";
  /** 每次 stop() 加一；start() 以此判斷自己是否已被取消 */
  let generation = 0;
  let pending: Promise<boolean> | null = null;

  const release = () => {
    stream?.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
  };

  const run = async (): Promise<boolean> => {
    const myGen = generation;
    state = "starting";
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      if (myGen !== generation) {
        // 等待期間已被 stop()：立刻還回鏡頭
        s.getTracks().forEach((t) => t.stop());
        return false;
      }
      stream = s;
      s.getVideoTracks().forEach((t) =>
        t.addEventListener("ended", () => {
          if (stream !== s) return; // 已被我們自己換掉或關閉的舊串流
          release();
          state = "ended";
          api.onEnded?.();
        }),
      );
      video.srcObject = s;
      await video.play();
      if (myGen !== generation) return false;
      state = "running";
      return true;
    } catch (err) {
      if (myGen !== generation) return false; // 已取消：不把「被取消」當成錯誤
      release();
      const name = (err as DOMException)?.name;
      state = name === "NotAllowedError" ? "denied" : "failed";
      throw err;
    }
  };

  const api: CameraManager = {
    video,
    onEnded: null,
    get state() {
      return state;
    },
    start() {
      if (state === "running") return Promise.resolve(true);
      if (pending) return pending;
      pending = run().finally(() => {
        pending = null;
      });
      return pending;
    },
    stop() {
      generation++;
      release();
      if (state === "running" || state === "starting" || state === "ended") state = "idle";
    },
    captureFrame(): HTMLCanvasElement | null {
      if (state !== "running") return null;
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return null;
      const canvas = document.createElement("canvas");
      canvas.width = vw;
      canvas.height = vh;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(video, 0, 0, vw, vh);
      return canvas;
    },
  };
  return api;
}
