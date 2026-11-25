/** 本機優先儲存：localStorage 設定 + IndexedDB 人物／紀錄／照片／盤局快照。 */
import type { ChartKind, TimeBasis } from '../domain/qimen/types';

export const SCHEMA_VERSION = 1;
export const LS_KEY = 'qimengfun.v1';
export const IDB_NAME = 'qimengfun-v1';
export const IDB_VERSION = 1;

export interface Person {
  id: string;
  name: string;
  birthDate: string | null;
  birthTime: string | null;
  birthTimePrecision: 'exact' | 'hour' | 'unknown';
  sex: 'male' | 'female' | null;
  birthPlace: string | null;
  birthTimezone: string | null;
  createdAt: string;
}

export interface ChartSnapshot {
  hash: string;
  kind: ChartKind;
  profileVersion: string;
  term: string;
  ju: number;
  dun: 'yang' | 'yin';
  pillars: Record<string, string>;
  palaces: unknown;
  validFromMs: number;
  validUntilMs: number;
}

export interface PhotoRecordMeta {
  id: string;
  personId: string | null;
  title: string;
  note: string;
  capturedAt: string;
  chartInstant: string;
  chartHash: string;
  chartKind: ChartKind;
  chart: ChartSnapshot | null;
  keStatus: 'unverified' | 'not-used';
  profileVersion: string;
  basis: TimeBasis;
  timezone: string;
  longitude: number | null;
  headingRaw: number | null;
  headingDisplay: number | null;
  quality: 'valid' | 'uncertain' | 'unavailable';
  source: 'sensor' | 'manual';
  northReference: 'magnetic' | 'true';
  nearBoundary: boolean;
  photoId: string | null;
  simulated: boolean;
  schemaVersion: number;
}

export interface AppSettings {
  basis: TimeBasis;
  timezone: string;
  longitude: number | null;
  lightTheme: 'focus' | 'all' | 'blue';
  reducedMotion: boolean;
  powerSave: boolean;
  layerPreset: 'simple' | 'professional' | 'custom';
  customLayers: string[];
  currentPersonId: string | null;
  eventKind: string;
  northReference: 'magnetic' | 'true';
  manualOffsetDeg: number;
  onboarded: boolean;
}

export interface LSData {
  schemaVersion: number;
  persons: Person[];
  settings: AppSettings;
}

export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function defaultSettings(): AppSettings {
  return {
    basis: 'civil',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Taipei',
    longitude: null,
    lightTheme: 'focus',
    reducedMotion: false,
    powerSave: false,
    layerPreset: 'professional',
    customLayers: ['earth', 'heaven', 'stars', 'doors', 'deities', 'outer', 'light'],
    currentPersonId: null,
    eventKind: 'general',
    northReference: 'magnetic',
    manualOffsetDeg: 0,
    onboarded: false,
  };
}

export function defaultLS(): LSData {
  return { schemaVersion: SCHEMA_VERSION, persons: [], settings: defaultSettings() };
}

export function loadLS(): LSData {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultLS();
    const parsed = JSON.parse(raw) as Partial<LSData>;
    const base = defaultSettings();
    const s: Partial<AppSettings> = parsed.settings ?? {};
    return {
      schemaVersion: SCHEMA_VERSION,
      persons: Array.isArray(parsed.persons) ? parsed.persons : [],
      settings: {
        ...base,
        ...s,
        customLayers: Array.isArray(s.customLayers) ? s.customLayers : base.customLayers,
      },
    };
  } catch {
    return defaultLS();
  }
}

export function saveLS(data: LSData): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ ...data, schemaVersion: SCHEMA_VERSION })); }
  catch { /* quota / private mode: keep in-memory */ }
}

interface PhotoEntry { id: string; blob: Blob; mimeType: string; createdAt: string }

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('persons')) db.createObjectStore('persons', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('records')) {
        const store = db.createObjectStore('records', { keyPath: 'id' });
        store.createIndex('capturedAt', 'capturedAt');
        store.createIndex('personId', 'personId');
      }
      if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    t.oncomplete = () => db.close();
  });
}

export const putPhoto = (p: PhotoEntry) => tx('photos', 'readwrite', (s) => s.put(p));
export const getPhoto = (id: string) => tx<PhotoEntry | undefined>('photos', 'readonly', (s) => s.get(id));
export const deletePhoto = (id: string) => tx('photos', 'readwrite', (s) => s.delete(id));
export const putRecord = (r: PhotoRecordMeta) => tx('records', 'readwrite', (s) => s.put(r));
export const deleteRecord = (id: string) => tx('records', 'readwrite', (s) => s.delete(id));
export async function listRecords(): Promise<PhotoRecordMeta[]> {
  const all = await tx<PhotoRecordMeta[]>('records', 'readonly', (s) => s.getAll());
  return all.sort((a, b) => b.capturedAt.localeCompare(a.capturedAt));
}
export async function listPhotos(): Promise<PhotoEntry[]> {
  return tx<PhotoEntry[]>('photos', 'readonly', (s) => s.getAll());
}
export const putPerson = (p: Person) => tx('persons', 'readwrite', (s) => s.put(p));
export const deletePerson = (id: string) => tx('persons', 'readwrite', (s) => s.delete(id));

export async function estimateStorage(): Promise<{ usage: number; quota: number } | null> {
  if (!navigator.storage?.estimate) return null;
  const e = await navigator.storage.estimate();
  return { usage: e.usage ?? 0, quota: e.quota ?? 0 };
}
