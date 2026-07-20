# 設計書 — 中古マンション評価ウェブアプリ

対象リポジトリ: `ryotaguchi21/Claude` / 実装ブランチ: `claude/used-apartment-eval-app-vx4sr2`

## 1. 目的とコンセプト

- 中古マンションの物件ページURLを入力すると、LLM（Claude API）が物件を自動評価し、
  **不動産にくわしくない人でも読めるレポート**をスマホで表示する。
- 評価ロジックは「評価エンジンプロンプト」（`lib/evaluation-prompt.ts`）に完全分離し、
  **アプリは器（UI + API仲介 + 保存）に徹する**。エンジンプロンプトは無改変で差し替え可能。

## 2. 全体アーキテクチャ

```
[ブラウザ (スマホ)]
  ├─ app/page.tsx        … 3画面SPA（入力/結果/履歴 + 手入力フォールバック + ローディング）
  ├─ localStorage        … 履歴保存（端末内・ログイン不要）
  └─ fetch POST /api/evaluate
         │
[Next.js サーバー (API Route)]
  └─ app/api/evaluate/route.ts
       ├─ system = ENGINE_PROMPT（無改変） + 出力フォーマット指示
       ├─ Claude API claude-opus-4-8
       │    tools: web_search_20260209 / web_fetch_20260209（サーバーツール）
       │    thinking: adaptive / streaming + finalMessage / pause_turn 継続(最大5回)
       └─ 応答テキストをマーカー解析 → { meta(JSON), reportHtml } を返却
```

### 技術選定

| 項目 | 選定 | 理由 |
|---|---|---|
| フレームワーク | Next.js 14 (App Router) + TypeScript | 1リポジトリでUIとAPIキー秘匿（サーバールート）を両立 |
| LLM | `claude-opus-4-8` + Web検索/Webフェッチ | 物件ページ読取と相場調査をサーバーツールで完結。スクレイピング実装不要 |
| 保存 | サーバー共有ストア（`data/history.json` + `/api/history`） | 全ユーザー共有・ログイン不要（v2で変更）。サーバーレス本番では `DATA_DIR` 永続化 or KV/DB差し替え |
| スタイル | 素CSS（globals.css） | 依存最小。信号色・文字サイズ規定を直接管理。UI/UXは apple-design スキル準拠（v2） |

## 3. 画面設計（3画面 + 補助2画面）

| 画面 | view状態 | 内容 |
|---|---|---|
| (a) 入力 | `input` | URL入力欄＋「評価する」。下に履歴導線。エラーはこの画面上部に表示 |
| (b) 評価結果 | `result` | ①読み取り確認カード → ②判定バッジ → ③価格ゲージ → ④レポート1〜4 → ⑤折りたたみ5 → 再評価ボタン |
| (c) 履歴一覧 | `history` | カード縦並び。各行=判定ミニバッジ・物件名・価格・一言サマリ・評価日・🗑。タップで保存済み再表示（再計算なし） |
| 補助: ローディング | `loading` | 経過秒数で進捗メッセージ切替（読取→相場→計算→環境→まとめ）＋スケルトン |
| 補助: 手入力 | `manual` | フォールバック（URL読取失敗）と修正再評価の共用フォーム。住所・価格が必須 |

### UIルール（厳守事項）

- スマホ1カラム（max-width 480px）・横スクロールなし（表はセクション5内のみ、`overflow-x: auto`）
- 本文16px以上、重要数字は `.big-number` 24px太字（単位も17px太字）
- 信号色: 割安=緑 `#16a34a` / 妥当=青 `#2563eb` / やや割高=オレンジ `#ea580c` / 割高=赤 `#dc2626`
  - 判定記号との対応: ◎→緑 / ○→青 / △→オレンジ / ×→赤（`lib/verdict.ts` に集約）
- セクション見出し絵文字: 1📋 / 2🏠 / 3💰 / 4🚃🌳💬 / 5🔍
- セクション5は `<details>` アコーディオンで初期閉

### 価格ゲージ（最重要コンポーネント）

`components/PriceGauge.tsx`。メタJSONの数値（万円）から**アプリ側で描画**する
（LLMのHTMLに任せない — 表示の信頼性を担保するため）。

- 緑帯 = 妥当価格レンジ [fairMin, fairMax]
- ▼マーカー = 売出価格 listPrice（帯より右なら一目で割高）
- │縦線 = 推奨指値 targetPrice
- スケールは全値の min/max ± 15% で自動決定。null項目があればゲージ自体を非表示

## 4. データ設計

```ts
EvalRecord {                 // 履歴1件（共有ストア data/history.json。旧localStorage分は初回アクセス時に自動移行）
  id: string                 // ev_<ts36>_<rand>
  url: string | null         // 手入力評価は null
  evaluatedAt: string        // ISO 8601
  meta: EvalMeta
  reportHtml: string         // サニタイズ済みHTML断片
}
EvalMeta {
  propertyName, verdict(◎○△×), verdictLabel, summary, recommendation(買い/条件つき/見送り)
  property: { name, address, station, price, area, layout, floor, direction,
              builtYear, totalUnits, managementFee, repairFund }   // すべて文字列、"不明"許容
  priceGauge: { fairMin, fairMax, listPrice, targetPrice }         // 万円 or null
}
```

## 5. API設計

### POST `/api/evaluate`

| 入力 | `{ url }` または `{ manual: {name,address,price,area,floor,builtYear} }` |
|---|---|
| 成功 200 | `{ meta: EvalMeta, reportHtml: string }` |
| 失敗 | `{ error: string, code }` — `INVALID_URL`(400) / `PAGE_UNREADABLE`(422→手入力フォールバック) / `PARSE_FAILED`(502) / `API_ERROR`(429/500/502) |

- `maxDuration = 300`（1評価2〜5分想定）
- LLM出力プロトコル（アプリが機械解析するマーカー方式）:
  - `===META_START=== {JSON} ===META_END===`
  - `===REPORT_START=== <HTML断片> ===REPORT_END===`
  - 読取不能時は `===ERROR_START=== 理由 ===ERROR_END===` のみ → 422で返しフォールバックUIへ
- レポートHTMLはサーバーで `<script>`/`<style>`/`on*=` 属性を除去してから返却

### プロンプト構成

```
system = ENGINE_PROMPT（lib/evaluation-prompt.ts、無改変）
       + OUTPUT_FORMAT_INSTRUCTIONS（マーカー・HTMLクラス規約・グレード色クラス）
user   = 「このURLを取得して評価して」or「手入力情報＋相場調査で評価して」
```

## 6. 状態遷移（page.tsx）

```
input --評価する--> loading --成功--> result
                        └--PAGE_UNREADABLE--> manual --評価--> loading --> result
                        └--その他エラー--> input(エラー表示)
result --修正して再評価--> manual(プレフィル, 同一IDを置換)
result --最新相場で再評価--> loading --> result(同一IDを置換)
history --行タップ--> result(保存済み表示・API呼び出しなし)
history --🗑--> confirm → 削除
```

## 7. エラー・例外方針

| 事象 | 挙動 |
|---|---|
| URL形式不正 | 送信前 or 400。入力画面にメッセージ |
| 掲載終了・読取失敗 | LLMがERRORブロック→422→手入力フォールバック画面 |
| LLM出力の解析失敗 | 502 PARSE_FAILED「もう一度お試しください」 |
| レート制限/refusal/通信断 | ユーザー向け平易文言でエラーボックス表示。履歴は壊さない |
| 共有ストア書き込み失敗 | 一時ファイル書き込み→rename のアトミック更新。読めない場合は空配列扱い |

## 8. 将来拡張（現時点では実装しない）

- **永続DB化**: 共有はv2で実装済み（ログイン不要のファイルストア）。本番の耐久性が必要になったら
  `lib/server-store.ts` のインターフェースを維持したまま KV/Postgres 実装に差し替える
- SSEストリーミングでローディングに実進捗（検索クエリ等）を表示
- 履歴の並び替え・比較ビュー（2物件横並び）

## 9. 受け入れ基準（全体）

1. `npm run build` が型エラーなく通る
2. URL入力→評価→結果表示→履歴保存→再表示（再計算なし）→削除が一連で動作
3. 不正URL・読取失敗・APIキー未設定それぞれで適切な日本語エラー/フォールバックが出る
4. 判定色が信号ルールに一致し、価格ゲージが▼と緑帯の位置関係で割高を表現できる
5. iPhone SE幅(375px)で横スクロールが発生しない
