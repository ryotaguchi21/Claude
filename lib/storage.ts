import type { EvalRecord } from "./types";

/**
 * 履歴は共有ストア（サーバー側 /api/history）に保存する。
 * ログイン不要・全ユーザーが同じ履歴を閲覧できる。
 */

const LEGACY_KEY = "mansion-eval-history-v1"; // 旧: 端末内localStorage保存
const MIGRATED_FLAG = "mansion-eval-migrated-v1";

/** 共有履歴を新しい順で取得 */
export async function fetchHistory(): Promise<EvalRecord[]> {
  const res = await fetch("/api/history", { cache: "no-store" });
  if (!res.ok) throw new Error("履歴の取得に失敗しました");
  const data = (await res.json()) as { records: EvalRecord[] };
  return data.records ?? [];
}

export async function deleteRecordRemote(id: string): Promise<void> {
  await fetch(`/api/history?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

/**
 * 旧バージョンでこの端末に保存された評価済みデータ（searched/scored済み）を、
 * 初回アクセス時に一度だけ共有ストアへ取り込む。
 */
export async function migrateLegacyHistoryOnce(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if (window.localStorage.getItem(MIGRATED_FLAG)) return;
    const raw = window.localStorage.getItem(LEGACY_KEY);
    if (raw) {
      const records = JSON.parse(raw) as EvalRecord[];
      if (Array.isArray(records) && records.length > 0) {
        await fetch("/api/history", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ records }),
        });
      }
    }
    window.localStorage.setItem(MIGRATED_FLAG, "1");
  } catch {
    // 移行失敗は致命的ではない（次回また試行される）
  }
}
