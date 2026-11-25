/** 拍照合成：實際 cover crop 畫面 + 固定遮罩 + 盤面 + 盤局時間資訊卡。 */
import fontUrl from '../assets/fonts/qm-serif-bold.woff2?url';
import { computeCoverCrop } from './coverCrop';

export const DIAL_SERIF = "'QM Serif','Noto Serif TC','Songti TC','PingFang TC',sans-serif";

export interface CaptureInfo {
  headline: string;
  main: string;
  meta: string;
  tone: 'good' | 'bad' | 'warn';
  warn?: string;
}

export interface CompositeInput {
  video: HTMLVideoElement | null;
  sceneEl: HTMLElement;
  dialEl: SVGSVGElement | null;
  info: CaptureInfo;
  maxEdge?: number;
  quality?: number;
}

let fontDataUri: string | null = null;
async function getFontDataUri(): Promise<string> {
  if (fontDataUri) return fontDataUri;
  try {
    const res = await fetch(fontUrl);
    const buf = await res.arrayBuffer();
    const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
    fontDataUri = `data:font/woff2;base64,${base64}`;
  } catch {
    fontDataUri = '';
  }
  return fontDataUri;
}

export async function composeCapture(input: CompositeInput): Promise<Blob> {
  const rect = input.sceneEl.getBoundingClientRect();
  const maxEdge = input.maxEdge ?? 2048;
  const scale = Math.min(1, maxEdge / Math.max(rect.width, rect.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(rect.width * scale));
  canvas.height = Math.max(1, Math.round(rect.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('無法建立畫布');

  if (input.video && input.video.videoWidth > 0) {
    const crop = computeCoverCrop(input.video.videoWidth, input.video.videoHeight, canvas.width, canvas.height);
    ctx.drawImage(input.video, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, canvas.width, canvas.height);
  } else {
    const grad = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 10, canvas.width / 2, canvas.height / 2, canvas.width);
    grad.addColorStop(0, '#12324a');
    grad.addColorStop(1, '#041323');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // 固定冷灰藍遮罩（18%，無控制、無自適應）
  ctx.fillStyle = 'rgba(30,45,60,.18)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  if (input.dialEl) {
    const dr = input.dialEl.getBoundingClientRect();
    const svg = input.dialEl.cloneNode(true) as SVGSVGElement;
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    const font = await getFontDataUri();
    if (font) {
      const style = document.createElementNS('http://www.w3.org/2000/svg', 'style');
      style.textContent = `@font-face{font-family:'QM Serif';src:url('${font}') format('woff2');font-weight:700;}`;
      svg.insertBefore(style, svg.firstChild);
    }
    const xml = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml;charset=utf-8' }));
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('盤面點陣化失敗'));
        img.src = url;
      });
      ctx.drawImage(img, (dr.left - rect.left) * scale, (dr.top - rect.top) * scale, dr.width * scale, dr.height * scale);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  const pad = 18 * scale;
  const h = 96 * scale;
  const y = canvas.height - h - 14 * scale;
  ctx.fillStyle = 'rgba(4,19,35,.86)';
  ctx.strokeStyle = 'rgba(114,213,255,.5)';
  ctx.lineWidth = 1.2 * scale;
  roundRect(ctx, pad, y, canvas.width - pad * 2, h, 12 * scale);
  ctx.fill();
  ctx.stroke();

  const color = input.info.tone === 'good' ? '#36EBC0' : input.info.tone === 'bad' ? '#DD6675' : '#72D5FF';
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;
  ctx.font = `700 ${20 * scale}px ${DIAL_SERIF}`;
  ctx.fillText(input.info.headline, pad + 16 * scale, y + 12 * scale);
  ctx.fillStyle = '#D9F3FF';
  ctx.font = `700 ${15 * scale}px ${DIAL_SERIF}`;
  ctx.fillText(input.info.main, pad + 16 * scale, y + 40 * scale);
  ctx.fillStyle = '#7293B0';
  ctx.font = `${12 * scale}px system-ui,sans-serif`;
  ctx.fillText(input.info.meta, pad + 16 * scale, y + 66 * scale);
  if (input.info.warn) {
    ctx.fillStyle = '#DD6675';
    ctx.fillText(input.info.warn, pad + 16 * scale, y + 82 * scale);
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('JPEG 合成失敗'))), 'image/jpeg', input.quality ?? 0.88);
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
