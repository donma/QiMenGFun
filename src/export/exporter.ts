/** 匯出：JSON / ZIP（fflate）/ 單張 JPEG / Web Share。無匯入還原。 */
import { zipSync, type Zippable } from 'fflate';
import { getPhoto, listPhotos, listRecords, loadLS, type PhotoRecordMeta } from '../storage/storage';

export interface ExportResult { filename: string; blob: Blob; isZip: boolean }

function stamp(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}

export function buildExportJSON(): Blob {
  const ls = loadLS();
  const payload = {
    schemaVersion: 1,
    app: 'QiMenGFun',
    appVersion: '0.1.0-preview',
    exportedAt: new Date().toISOString(),
    notice: '資料僅本機保存，可能因系統清除而遺失；請定期匯出。',
    persons: ls.persons,
    settings: ls.settings,
    records: [] as PhotoRecordMeta[],
    photos: [] as Array<{ id: string; file: string; mimeType: string }>,
  };
  // records / photos 由非同步 exportZip 填入；此函式供預覽與測試。
  return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
}

export async function exportZip(): Promise<ExportResult> {
  const [records, photos] = await Promise.all([listRecords(), listPhotos()]);
  const ls = loadLS();
  const payload = {
    schemaVersion: 1,
    app: 'QiMenGFun',
    appVersion: '0.1.0-preview',
    exportedAt: new Date().toISOString(),
    notice: '資料僅本機保存，可能因系統清除而遺失；請定期匯出。',
    persons: ls.persons,
    settings: ls.settings,
    records,
    photos: photos.map((p) => ({ id: p.id, file: `photos/${p.id}.jpg`, mimeType: p.mimeType })),
  };
  const files: Zippable = { 'qimengfun-data.json': new TextEncoder().encode(JSON.stringify(payload, null, 2)) };
  for (const p of photos) files[`photos/${p.id}.jpg`] = new Uint8Array(await p.blob.arrayBuffer());
  const zipped = zipSync(files, { level: 0 });
  return { filename: `qimengfun-export-${stamp()}.zip`, blob: new Blob([zipped as BlobPart], { type: 'application/zip' }), isZip: true };
}

export async function exportSinglePhotoJpeg(photoId: string): Promise<ExportResult | null> {
  const photo = await getPhoto(photoId);
  if (!photo) return null;
  return { filename: `qimengfun-${photoId}.jpg`, blob: photo.blob, isZip: false };
}

export async function shareOrDownload(filename: string, blob: Blob): Promise<'shared' | 'downloaded'> {
  const file = new File([blob], filename, { type: blob.type });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title: 'QiMenGFun 匯出' });
      return 'shared';
    } catch (err) {
      if ((err as Error).name === 'AbortError') return 'shared';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return 'downloaded';
}

/** AI 複製：先預覽、預設排除個資、明確不自動送出。 */
export function buildAIPrompt(chartText: string, eventLabel: string, includePrivate: boolean, privateText: string): string {
  return [
    '以下是一張已由本機排盤程式產生的奇門遁甲盤局資料，請「不要重新計算盤局」，依提供的資料與傳統象意解釋。',
    `事件類別：${eventLabel}`,
    includePrivate && privateText ? `使用者補充（自願提供）：${privateText}` : '（已排除姓名、精確位置與生日；未經勾選不提供個資）',
    '',
    chartText,
    '',
    '要求：',
    '1. 不要重新排盤、不要宣稱聽到或測到任何物理能量。',
    '2. 明確指出資料中標示為未知的規則或無法確定的部分。',
    '3. 只依提供的盤局與傳統象意說明可能的考量，不承諾求財、健康、投資等結果。',
    '4. 這是傳統文化參考，不是科學驗證的預測。',
  ].join('\n');
}
