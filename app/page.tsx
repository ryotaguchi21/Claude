"use client";

import { useEffect, useState } from "react";
import LoadingView from "@/components/LoadingView";
import HistoryView from "@/components/HistoryView";
import ResultView from "@/components/ResultView";
import ManualForm from "@/components/ManualForm";
import { nextRunLabel, submitRequest } from "@/lib/request-queue";
import { deleteRecordRemote, fetchHistory, migrateLegacyHistoryOnce } from "@/lib/storage";
import type {
  EvalRecord,
  EvaluateError,
  EvaluateRequest,
  EvaluateResponse,
  ManualInput,
} from "@/lib/types";

type View = "input" | "loading" | "result" | "history" | "manual";

/** 静的配信モード(Cloudflare Pages・サブスク内運用): 即時評価せず受付キューに積む */
const STATIC_MODE = process.env.NEXT_PUBLIC_STATIC === "1";

interface ManualContext {
  /** fallback: URL読み取り失敗後の手入力 / correction: 読み取り内容の修正再評価 */
  mode: "fallback" | "correction";
  initial?: Partial<ManualInput>;
  /** correction・再評価時に置き換える履歴ID */
  recordId?: string;
  note?: string;
}

async function callEvaluate(body: EvaluateRequest): Promise<EvalRecord> {
  const res = await fetch("/api/evaluate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as EvaluateResponse & EvaluateError;
  if (!res.ok) {
    const err = new Error(data.error || "評価に失敗しました") as Error & { code?: string };
    err.code = data.code;
    throw err;
  }
  return data.record;
}

function propertyToManual(record: EvalRecord): ManualInput {
  return {
    name: record.meta.property?.name ?? "",
    address: record.meta.property?.address ?? "",
    price: record.meta.property?.price ?? "",
    area: record.meta.property?.area ?? "",
    floor: record.meta.property?.floor ?? "",
    builtYear: record.meta.property?.builtYear ?? "",
  };
}

export default function Home() {
  const [view, setView] = useState<View>("input");
  const [url, setUrl] = useState("");
  const [records, setRecords] = useState<EvalRecord[]>([]);
  const [current, setCurrent] = useState<EvalRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [manualCtx, setManualCtx] = useState<ManualContext | null>(null);
  const [reEvaluating, setReEvaluating] = useState(false);

  // 起動時: 旧端末内履歴を共有ストアへ一度だけ移行してから、共有履歴を取得
  useEffect(() => {
    (async () => {
      await migrateLegacyHistoryOnce();
      try {
        setRecords(await fetchHistory());
      } catch {
        // 履歴取得失敗は評価機能自体を妨げない
      }
    })();
  }, []);

  /** 一覧stateへ upsert（先頭へ） */
  function upsertLocal(record: EvalRecord) {
    setRecords((prev) => [record, ...prev.filter((r) => r.id !== record.id)]);
  }

  /** 新規評価（URL入力） */
  async function evaluateUrl() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setError(null);
    setNotice(null);
    if (STATIC_MODE) {
      // サブスク内運用: その場では評価せず受付キューへ(定期便 6/12/18/24時が評価)
      try {
        await submitRequest(trimmed);
        setNotice(
          `✅ 受け付けました！ 次の定期便（${nextRunLabel()}ごろ）で評価され、「評価ずみ物件」に追加されます。`,
        );
        setUrl("");
      } catch (e) {
        setError((e as Error).message);
      }
      return;
    }
    setView("loading");
    try {
      const record = await callEvaluate({ url: trimmed });
      upsertLocal(record);
      setCurrent(record);
      setView("result");
      setUrl("");
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "PAGE_UNREADABLE") {
        // 掲載終了・読み取り失敗 → 手入力フォールバック
        setManualCtx({
          mode: "fallback",
          note: `ページを読み取れませんでした（${err.message}）。物件情報を入力すると評価できます。`,
        });
        setView("manual");
      } else {
        setError(err.message);
        setView("input");
      }
    }
  }

  /** 手入力評価（フォールバック / 修正再評価） */
  async function evaluateManual(input: ManualInput) {
    const ctx = manualCtx;
    setError(null);
    setView("loading");
    try {
      const record = await callEvaluate({ manual: input, recordId: ctx?.recordId });
      upsertLocal(record);
      setCurrent(record);
      setManualCtx(null);
      setView("result");
    } catch (e) {
      setError((e as Error).message);
      setView(ctx ? "manual" : "input");
    }
  }

  /** 履歴からの再評価（相場は変動するため最新データで取り直す） */
  async function reEvaluate(record: EvalRecord) {
    if (STATIC_MODE) {
      // 再評価も受付キュー経由(URLがない手入力物件は定期便の自動最新化に任せる)
      setError(null);
      setNotice(null);
      try {
        if (record.url) await submitRequest(record.url);
        setNotice(
          record.url
            ? `✅ 再評価を受け付けました。次の定期便（${nextRunLabel()}ごろ）で最新の相場に更新されます。`
            : "この物件はURLがないため、定期便の自動更新をお待ちください。",
        );
      } catch (e) {
        setError((e as Error).message);
      }
      return;
    }
    setReEvaluating(true);
    setError(null);
    try {
      const body: EvaluateRequest = record.url
        ? { url: record.url, recordId: record.id }
        : { manual: propertyToManual(record), recordId: record.id };
      setView("loading");
      const updated = await callEvaluate(body);
      upsertLocal(updated);
      setCurrent(updated);
      setView("result");
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "PAGE_UNREADABLE") {
        setManualCtx({
          mode: "fallback",
          recordId: record.id,
          initial: propertyToManual(record),
          note: "掲載が終了した可能性があります。物件情報を確認して再評価できます。",
        });
        setView("manual");
      } else {
        setError(err.message);
        setView("result");
      }
    } finally {
      setReEvaluating(false);
    }
  }

  /** 読み取り確認カードの「修正して再評価」 */
  function startCorrection(record: EvalRecord) {
    if (STATIC_MODE) {
      setNotice("表示内容の修正は定期便の自動更新に反映されます。急ぎの場合はスプレッドシートのメモ欄に書いてください。");
      return;
    }
    setManualCtx({
      mode: "correction",
      recordId: record.id,
      initial: propertyToManual(record),
    });
    setView("manual");
  }

  async function handleDelete(id: string) {
    setRecords((prev) => prev.filter((r) => r.id !== id));
    await deleteRecordRemote(id);
  }

  return (
    <main className="container">
      {view === "input" && (
        <>
          <header className="app-header">
            <h1>🏠 Kei House Search</h1>
          </header>
          {error && <div className="error-box">{error}</div>}
          {notice && <div className="notice-box">{notice}</div>}
          <div className="card">
            <label className="field-label" htmlFor="url-input" style={{ marginTop: 0, fontSize: 15 }}>
              物件ページのURLを貼り付けてください
            </label>
            <input
              id="url-input"
              className="url-input"
              type="url"
              inputMode="url"
              placeholder="https://suumo.jp/ms/chuko/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && evaluateUrl()}
            />
            <p className="hint">SUUMO・アットホーム・HOME'Sなどの物件ページに対応</p>
            <button type="button" className="btn-primary" disabled={!url.trim()} onClick={evaluateUrl}>
              評価する
            </button>
          </div>
          <button type="button" className="btn-secondary" onClick={() => setView("history")}>
            📚 評価ずみ物件を見る{records.length > 0 ? `（${records.length}件）` : ""}
          </button>
          <p className="footer-note">評価結果はみんなで共有されます（ログイン不要）</p>
        </>
      )}

      {view === "loading" && (
        <>
          <header className="app-header">
            <h1>評価中…</h1>
          </header>
          <LoadingView />
        </>
      )}

      {view === "manual" && manualCtx && (
        <>
          <header className="app-header">
            <button
              type="button"
              className="back"
              aria-label="戻る"
              onClick={() => {
                setManualCtx(null);
                setView(manualCtx.mode === "correction" && current ? "result" : "input");
              }}
            >
              ←
            </button>
            <h1>物件情報の入力</h1>
          </header>
          {error && <div className="error-box">{error}</div>}
          <ManualForm
            title={manualCtx.mode === "correction" ? "読み取り内容の修正" : "物件情報を手入力"}
            note={
              manualCtx.note ??
              (manualCtx.mode === "correction"
                ? "正しい情報に直して「再評価する」を押してください。"
                : "わかる範囲で入力してください（住所と価格は必須）。")
            }
            initial={manualCtx.initial}
            submitLabel={manualCtx.mode === "correction" ? "この内容で再評価する" : "この内容で評価する"}
            onSubmit={evaluateManual}
            onCancel={() => {
              setManualCtx(null);
              setView(manualCtx.mode === "correction" && current ? "result" : "input");
            }}
          />
        </>
      )}

      {view === "result" && current && (
        <>
          <header className="app-header">
            <button type="button" className="back" aria-label="戻る" onClick={() => setView("input")}>
              ←
            </button>
            <h1>評価レポート</h1>
            <button type="button" className="btn-ghost" onClick={() => setView("history")}>
              履歴
            </button>
          </header>
          {error && <div className="error-box">{error}</div>}
          {notice && <div className="notice-box">{notice}</div>}
          <ResultView
            record={current}
            onCorrect={() => startCorrection(current)}
            onReEvaluate={() => reEvaluate(current)}
            reEvaluating={reEvaluating}
          />
        </>
      )}

      {view === "history" && (
        <>
          <header className="app-header">
            <button type="button" className="back" aria-label="戻る" onClick={() => setView("input")}>
              ←
            </button>
            <h1>評価ずみ物件（共有）</h1>
          </header>
          <HistoryView
            records={records}
            onOpen={(r) => {
              // 保存済みレポートを再表示（再計算しない）
              setCurrent(r);
              setError(null);
              setView("result");
            }}
            onDelete={STATIC_MODE ? undefined : handleDelete}
          />
        </>
      )}
    </main>
  );
}
