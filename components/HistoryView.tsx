"use client";

import type { EvalRecord } from "@/lib/types";
import { verdictColorClass } from "@/lib/verdict";

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/** 履歴一覧画面（各行: 物件名・売出価格・判定バッジ・サマリ一言・評価日） */
export default function HistoryView({
  records,
  onOpen,
  onDelete,
}: {
  records: EvalRecord[];
  onOpen: (record: EvalRecord) => void;
  /** 未指定なら削除ボタンを出さない（静的配信モード） */
  onDelete?: (id: string) => void;
}) {
  if (records.length === 0) {
    return <div className="empty-note">まだ評価した物件がありません。<br />URLを入力して最初の評価をしてみましょう。</div>;
  }

  return (
    <div>
      {records.map((r) => (
        <div key={r.id} className="history-item">
          <div className={`mini-badge ${verdictColorClass(r.meta.verdict)}`}>{r.meta.verdict}</div>
          <button
            type="button"
            className="history-main"
            style={{ border: "none", background: "none", padding: 0, font: "inherit", textAlign: "left" }}
            onClick={() => onOpen(r)}
          >
            <div className="history-name">{r.meta.propertyName || r.meta.property?.name || "（物件名不明）"}</div>
            <div className="history-sub">
              <span>{r.meta.property?.price || "価格不明"}</span>
              <span>{fmtDate(r.evaluatedAt)} 評価</span>
            </div>
            <div className="history-summary">{r.meta.summary}</div>
          </button>
          {onDelete && (
            <button
              type="button"
              className="trash-btn"
              aria-label="この履歴を削除"
              onClick={() => {
                if (window.confirm(`「${r.meta.propertyName || "この物件"}」の評価を削除しますか？`)) {
                  onDelete(r.id);
                }
              }}
            >
              🗑
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
