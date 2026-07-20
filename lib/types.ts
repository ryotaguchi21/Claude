/** 判定記号: ◎=割安 / ○=妥当 / △=やや割高 / ×=割高 */
export type Verdict = "◎" | "○" | "△" | "×";

/** 読み取った物件情報（読み取り確認カードに表示） */
export interface PropertyInfo {
  name: string;
  address: string;
  station: string;
  price: string;
  area: string;
  layout: string;
  floor: string;
  direction: string;
  builtYear: string;
  totalUnits: string;
  managementFee: string;
  repairFund: string;
}

/** 価格ゲージ用の数値（単位: 万円）。取得できなかった項目は null */
export interface PriceGaugeData {
  fairMin: number | null;
  fairMax: number | null;
  listPrice: number | null;
  targetPrice: number | null;
}

/** 評価レポートのメタ情報（LLM出力から抽出） */
export interface EvalMeta {
  propertyName: string;
  verdict: Verdict;
  verdictLabel: string; // 割安 / 妥当 / やや割高 / 割高
  summary: string; // 一言サマリ
  recommendation: string; // 買い / 条件つき / 見送り
  property: PropertyInfo;
  priceGauge: PriceGaugeData;
}

/** 履歴1件分の保存レコード */
export interface EvalRecord {
  id: string;
  url: string | null;
  evaluatedAt: string; // ISO 8601
  meta: EvalMeta;
  reportHtml: string;
}

/** 手入力フォールバックの入力値 */
export interface ManualInput {
  name: string;
  address: string;
  price: string;
  area: string;
  floor: string;
  builtYear: string;
}

/** /api/evaluate へのリクエスト */
export interface EvaluateRequest {
  url?: string;
  manual?: ManualInput;
  /** 修正再評価・最新相場での再評価時に、置き換える既存レコードのID */
  recordId?: string;
}

/** /api/evaluate の成功レスポンス（共有ストアへ保存済みのレコードを返す） */
export interface EvaluateResponse {
  record: EvalRecord;
}

/** /api/evaluate のエラーレスポンス */
export interface EvaluateError {
  error: string;
  /** PAGE_UNREADABLE: 掲載終了・読み取り失敗 → 手入力フォールバックを表示 */
  code?: "PAGE_UNREADABLE" | "INVALID_URL" | "PARSE_FAILED" | "API_ERROR";
}
