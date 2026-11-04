import { normalizeData } from '@/lib/backup';
import { notify } from '@/ui/dialog';
import { seedData, type AppData } from './state';

/**
 * データはこのブラウザの localStorage にだけ保存する（端末間で共有されない）。
 * 画面は useSyncExternalStore で subscribe / getSnapshot を使って読む。
 */
const DATA_KEY = 'managemoney:v1';
const LAST_BACKUP_KEY = 'managemoney:lastBackupAt';

type Listener = () => void;
const listeners = new Set<Listener>();
let data: AppData = load();

function load(): AppData {
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (raw) {
      const loaded = normalizeData(JSON.parse(raw));
      if (loaded) return loaded;
      // 壊れたデータは上書きせずに退避しておく
      localStorage.setItem(`${DATA_KEY}:broken:${Date.now()}`, raw);
    }
  } catch {
    // localStorage が使えない（プライベートモードなど）ときは保存なしで動かす
  }
  const seeded = seedData();
  persist(seeded);
  return seeded;
}

function persist(next: AppData): boolean {
  try {
    localStorage.setItem(DATA_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

function emit() {
  for (const listener of listeners) listener();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): AppData {
  return data;
}

/** データを変更して保存する。fn は state.ts の純粋関数 */
export function update(fn: (current: AppData) => AppData) {
  data = fn(data);
  if (!persist(data)) {
    notify('保存できませんでした', 'ブラウザの保存容量がいっぱいか、保存が許可されていません。');
  }
  emit();
}

/** バックアップから復元するときなど、データを丸ごと置き換える */
export function replaceAll(next: AppData) {
  update(() => next);
}

export function getLastBackupAt(): string | null {
  try {
    return localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    return null;
  }
}

export function setLastBackupAt(iso: string) {
  try {
    localStorage.setItem(LAST_BACKUP_KEY, iso);
  } catch {
    // 記録できなくても書き出し自体は済んでいる
  }
  emit();
}

if (typeof window !== 'undefined') {
  // 別のタブで変更されたら読み直す
  window.addEventListener('storage', (event) => {
    if (event.key !== DATA_KEY && event.key !== LAST_BACKUP_KEY) return;
    if (event.key === DATA_KEY) data = load();
    emit();
  });
  // ブラウザが容量不足のときに自動で消さないよう、永続化を頼んでおく（拒否されても動作は同じ）
  navigator.storage?.persist?.().catch(() => {});
}
