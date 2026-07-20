import { promises as fs } from "fs";
import path from "path";
import type { EvalRecord } from "./types";

/**
 * 共有ストア（ログイン不要・全ユーザー共通）。
 * data/history.json にファイル保存する。DATA_DIR 環境変数で保存先を変更可能。
 * 注意: サーバーレス環境ではファイルシステムが揮発性のため、
 *       永続化が必要な場合は DATA_DIR を永続ボリュームに向けるか KV/DB に差し替える。
 */
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), "data");
const FILE = path.join(DATA_DIR, "history.json");

async function readAll(): Promise<EvalRecord[]> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const list = JSON.parse(raw) as EvalRecord[];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

async function writeAll(records: EvalRecord[]): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmp = `${FILE}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(records, null, 2), "utf8");
  await fs.rename(tmp, FILE);
}

/** 新しい順で全件取得 */
export async function listRecords(): Promise<EvalRecord[]> {
  const records = await readAll();
  return records.sort(
    (a, b) => new Date(b.evaluatedAt).getTime() - new Date(a.evaluatedAt).getTime(),
  );
}

export async function getRecord(id: string): Promise<EvalRecord | null> {
  return (await readAll()).find((r) => r.id === id) ?? null;
}

/** 同一IDがあれば置換、なければ追加 */
export async function upsertRecord(record: EvalRecord): Promise<void> {
  const records = await readAll();
  const idx = records.findIndex((r) => r.id === record.id);
  if (idx >= 0) records[idx] = record;
  else records.push(record);
  await writeAll(records);
}

/** 一括登録（既存端末からの移行・シードデータ投入用）。既存IDは上書きしない */
export async function importRecords(incoming: EvalRecord[]): Promise<number> {
  const records = await readAll();
  const existing = new Set(records.map((r) => r.id));
  let added = 0;
  for (const r of incoming) {
    if (r && typeof r.id === "string" && r.meta && typeof r.reportHtml === "string" && !existing.has(r.id)) {
      records.push(r);
      existing.add(r.id);
      added++;
    }
  }
  if (added > 0) await writeAll(records);
  return added;
}

export async function removeRecord(id: string): Promise<boolean> {
  const records = await readAll();
  const next = records.filter((r) => r.id !== id);
  if (next.length === records.length) return false;
  await writeAll(next);
  return true;
}

export function newServerId(): string {
  return `ev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
