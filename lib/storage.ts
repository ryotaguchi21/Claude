import type { EvalRecord } from "./types";

const STORAGE_KEY = "mansion-eval-history-v1";

/** 履歴を新しい順で取得 */
export function loadHistory(): EvalRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw) as EvalRecord[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function persist(records: EvalRecord[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    // 容量超過時は古いものから削って再試行
    if (records.length > 1) persist(records.slice(0, Math.floor(records.length / 2)));
  }
}

/** 先頭（最新）に追加 */
export function addRecord(record: EvalRecord): EvalRecord[] {
  const next = [record, ...loadHistory()];
  persist(next);
  return next;
}

/** 再評価などで同一IDのレコードを置き換え */
export function replaceRecord(record: EvalRecord): EvalRecord[] {
  const next = loadHistory().map((r) => (r.id === record.id ? record : r));
  persist(next);
  return next;
}

export function deleteRecord(id: string): EvalRecord[] {
  const next = loadHistory().filter((r) => r.id !== id);
  persist(next);
  return next;
}

export function newId(): string {
  return `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
