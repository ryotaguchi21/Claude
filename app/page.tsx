"use client";

import { useEffect, useState } from "react";
import LoadingView from "@/components/LoadingView";
import HistoryView from "@/components/HistoryView";
import ResultView from "@/components/ResultView";
import ManualForm from "@/components/ManualForm";
import { addRecord, deleteRecord, loadHistory, newId, replaceRecord } from "@/lib/storage";
import type {
  EvalRecord,
  EvaluateError,
  EvaluateRequest,
  EvaluateResponse,
  ManualInput,
} from "@/lib/types";

type View = "input" | "loading" | "result" | "history" | "manual";

interface ManualContext {
  /** fallback: URL読み取り失敗後の手入力 / correction: 読み取り内容の修正再評価 */
  mode: "fallback" | "correction";
  initial?: Partial<ManualInput>;
  /** correction・再評価時に置き換える履歴ID */
  recordId?: string;
  /** 元のURL（保持して履歴に残す） */
  url?: string | null;
  note?: string;
}

async function callEvaluate(body: EvaluateRequest): Promise<EvaluateResponse> {
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
  return data;
}

export default function Home() {
  const [view, setView] = useState<View>("input");
  const [url, setUrl] = useState("");
  const [records, setRecords] = useState<EvalRecord[]>([]);
  const [current, setCurrent] = useState<EvalRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [manualCtx, setManualCtx] = useState<ManualContext | null>(null);
  const [reEvaluating, setReEvaluating] = useState(false);

  useEffect(() => {
    setRecords(loadHistory());
  }, []);

  /** 新規評価（URL入力） */
  async function evaluateUrl() {
    const trimmed = url.trim();
    if (!trimmed) return;
    setError(null);
    setView("loading");
    try {
      const data = await callEvaluate({ url: trimmed });
      const record: EvalRecord = {
        id: newId(),
        url: trimmed,
        evaluatedAt: new Date().toISOString(),
        meta: data.meta,
        reportHtml: data.reportHtml,
      };
      setRecords(addRecord(record));
      setCurrent(record);
      setView("result");
      setUrl("");
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "PAGE_UNREADABLE") {
        // 掲載終了・読み取り失敗 → 手入力フォールバック
        setManualCtx({
          mode: "fallback",
          url: trimmed,
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
      const data = await callEvaluate({ manual: input });
      const record: EvalRecord = {
        id: ctx?.recordId ?? newId(),
        url: ctx?.url ?? null,
        evaluatedAt: new Date().toISOString(),
        meta: data.meta,
        reportHtml: data.reportHtml,
      };
      setRecords(ctx?.recordId ? replaceRecord(record) : addRecord(record));
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
    setReEvaluating(true);
    setError(null);
    try {
      const body: EvaluateRequest = record.url
        ? { url: record.url }
        : {
            manual: {
              name: record.meta.property?.name ?? "",
              address: record.meta.property?.address ?? "",
              price: record.meta.property?.price ?? "",
              area: record.meta.property?.area ?? "",
              floor: record.meta.property?.floor ?? "",
              builtYear: record.meta.property?.builtYear ?? "",
            },
          };
      setView("loading");
      const data = await callEvaluate(body);
      const updated: EvalRecord = {
        ...record,
        evaluatedAt: new Date().toISOString(),
        meta: data.meta,
        reportHtml: data.reportHtml,
      };
      setRecords(replaceRecord(updated));
      setCurrent(updated);
      setView("result");
    } catch (e) {
      const err = e as Error & { code?: string };
      if (err.code === "PAGE_UNREADABLE") {
        setManualCtx({
          mode: "fallback",
          recordId: record.id,
          url: record.url,
          initial: {
            name: record.meta.property?.name ?? "",
            address: record.meta.property?.address ?? "",
            price: record.meta.property?.price ?? "",
            area: record.meta.property?.area ?? "",
            floor: record.meta.property?.floor ?? "",
            builtYear: record.meta.property?.builtYear ?? "",
          },
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
    setManualCtx({
      mode: "correction",
      recordId: record.id,
      url: record.url,
      initial: {
        name: record.meta.property?.name ?? "",
        address: record.meta.property?.address ?? "",
        price: record.meta.property?.price ?? "",
        area: record.meta.property?.area ?? "",
        floor: record.meta.property?.floor ?? "",
        builtYear: record.meta.property?.builtYear ?? "",
      },
    });
    setView("manual");
  }

  function handleDelete(id: string) {
    setRecords(deleteRecord(id));
  }

  return (
    <main className="container">
      {view === "input" && (
        <>
          <header className="app-header">
            <h1>🏢 中古マンション評価</h1>
          </header>
          {error && <div className="error-box">{error}</div>}
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
            📚 過去に評価した物件を見る{records.length > 0 ? `（${records.length}件）` : ""}
          </button>
          <p className="footer-note">履歴はこの端末のブラウザ内にだけ保存されます（ログイン不要）</p>
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
            <h1>評価した物件の履歴</h1>
          </header>
          <HistoryView
            records={records}
            onOpen={(r) => {
              // 保存済みレポートを再表示（再計算しない）
              setCurrent(r);
              setError(null);
              setView("result");
            }}
            onDelete={handleDelete}
          />
        </>
      )}
    </main>
  );
}
