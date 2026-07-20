"use client";

import type { EvalRecord } from "@/lib/types";
import PropertyCard from "./PropertyCard";
import VerdictBadge from "./VerdictBadge";
import PriceGauge from "./PriceGauge";

/**
 * 評価結果画面:
 * 読み取り確認カード → 判定バッジ → 価格ゲージ → レポート本文（1〜4＋折りたたみ5）
 */
export default function ResultView({
  record,
  onCorrect,
  onReEvaluate,
  reEvaluating,
}: {
  record: EvalRecord;
  onCorrect: () => void;
  onReEvaluate: () => void;
  reEvaluating: boolean;
}) {
  return (
    <div>
      <PropertyCard property={record.meta.property} onCorrect={onCorrect} />
      <VerdictBadge meta={record.meta} />
      <PriceGauge data={record.meta.priceGauge} />
      <div
        className="report"
        // LLM出力はサーバー側で script/style/イベント属性を除去済み
        dangerouslySetInnerHTML={{ __html: record.reportHtml }}
      />
      <button type="button" className="btn-secondary" onClick={onReEvaluate} disabled={reEvaluating}>
        🔄 最新の相場で再評価する
      </button>
      <p className="footer-note">
        評価日: {new Date(record.evaluatedAt).toLocaleString("ja-JP")}
        {record.url && (
          <>
            <br />
            <a href={record.url} target="_blank" rel="noopener noreferrer">元の物件ページを開く</a>
          </>
        )}
      </p>
      <p className="footer-note">
        ※ 本評価はAIによる参考情報です。購入判断は必ず現地確認・重要事項説明をご確認ください。
      </p>
    </div>
  );
}
