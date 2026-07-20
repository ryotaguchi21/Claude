# タスク一覧（Opus 実行用）

`docs/DESIGN.md` を正とし、各タスクは **単独のClaude Code（Opus）セッションに1枚ずつ渡せる粒度**で定義する。
各タスク票の「指示文」をそのままOpusに貼り付ければ実行できる。

- 状態: ✅=実装済み（ブランチ `claude/used-apartment-eval-app-vx4sr2` に反映済み） / ⬜=未着手
- 共通ルール（全タスクの前提としてOpusに渡すこと）:
  - 設計は `docs/DESIGN.md` に従う。信号色・文字サイズ・5セクション構成・マーカー方式は変更しない
  - `lib/evaluation-prompt.ts` の `ENGINE_PROMPT` は**無改変で使用**（差し替えはT-09のみが行う）
  - 完了条件に必ず `npm run build` 成功を含める

---

## フェーズ1: 基盤 【✅ 完了】

### T-01 ✅ プロジェクト土台
Next.js 14 + TypeScript雛形、`package.json` / `tsconfig.json` / `.env.local.example` / `.gitignore`。
**成果物**: ルート直下設定ファイル一式。**受け入れ**: `npm install && npm run build` 成功。

### T-02 ✅ 型・ストレージ・判定色の共通ライブラリ
`lib/types.ts`（EvalRecord/EvalMeta/PriceGaugeData/ManualInput/API入出力型）、
`lib/storage.ts`（localStorage CRUD、容量超過時の間引き）、`lib/verdict.ts`（◎○△×→信号色クラス）。
**受け入れ**: 型が全コンポーネント/APIで共有され、any不使用。

### T-03 ✅ 評価エンジンプロンプトの分離
`lib/evaluation-prompt.ts` に `ENGINE_PROMPT` を分離。貼り替え手順コメントと、
仕様準拠のデフォルトプロンプト（5セクション・◎○△×基準・指値/利回り算出）を同梱。
**受け入れ**: このファイル以外にプロンプト本体が存在しない。

## フェーズ2: 評価API 【✅ 完了】

### T-04 ✅ /api/evaluate 実装
`app/api/evaluate/route.ts`。Claude API `claude-opus-4-8`、`web_search_20260209`/`web_fetch_20260209`、
adaptive thinking、streaming + `finalMessage()`、`pause_turn` 継続（最大5回）、`maxDuration=300`。
マーカー解析（META/REPORT/ERROR）、HTMLサニタイズ、エラーコード体系（DESIGN §5/§7）。
**受け入れ**: 不正URL=400、本文なしAPIキーなし等が日本語メッセージのJSONで返る。

## フェーズ3: UI 【✅ 完了】

### T-05 ✅ 共通スタイルとレイアウト
`app/globals.css` + `app/layout.tsx`。信号色CSS変数、1カラム480px、16px基準、
`.big-number` 24px、レポートHTML用クラス（grade-*/spec-list/detail-section）。
**受け入れ**: 375px幅で横スクロールなし。

### T-06 ✅ 表示コンポーネント群
`VerdictBadge`（信号色大バッジ）/ `PriceGauge`（緑帯+▼+│、null時非表示）/
`PropertyCard`（読み取り確認+修正導線）/ `LoadingView`（経過秒で進捗切替+スケルトン）/
`ManualForm`（フォールバック・修正共用、住所/価格必須）/ `HistoryView`（一覧+🗑確認削除）/
`ResultView`（結果画面の組み立て+再評価ボタン+免責）。
**受け入れ**: ゲージの▼が緑帯右側に出るケースを目視確認。

### T-07 ✅ 画面制御（SPA本体）
`app/page.tsx`。DESIGN §6 の状態遷移どおりに5つのviewを制御。
履歴タップは保存済み表示のみ（API呼び出しなし）。修正/再評価は同一IDを置換保存。
**受け入れ**: 遷移図の全パスが動作。

### T-08 ✅ ドキュメント
`README.md`（セットアップ・プロンプト差し替え手順・構成表・免責）。

---

## フェーズ4: 残作業 【⬜ ここからOpusに依頼する】

### T-09 ✅ 評価エンジンプロンプトの差し替え（2026-07-20 完了）
- 実施内容: Ryoの実運用システム `property-mansion-search`（Dropbox `Claude (WORKING)/property-mansion-search/`）の
  DD・スコアリング方法論（DD_REPLICATION_GUIDE.md / scoring.py / bid.py / building_fair.py）を
  `ENGINE_PROMPT` に移植。8軸100点採点・指値計算式・建物履歴比クロスチェック・落とし穴回避を含む。
  あわせて評価済み99物件のシードデータを `data/history.json` に投入
  （生成元: `property-mansion-search/_export_kei_seed.py`。再実行で最新スキャン結果に更新可能）。
- **受け入れ**: デフォルト文が完全に消え、受領全文が無改変で入っている。バッククォート等のエスケープ起因の構文エラーがない。`npm run build` 成功
- **Opusへの指示文**:
  > `lib/evaluation-prompt.ts` の `ENGINE_PROMPT` の中身を、以下に添付するプロンプト全文で完全に置き換えて。一切改変しないこと（テンプレートリテラルのエスケープが必要な場合のみ \` と \\ をエスケープし、内容は変えない）。他ファイルは触らない。`npm run build` が通ることを確認してコミット・プッシュして。
  > 【プロンプト全文をここに添付】

### T-10 ⬜ 実APIキーでのE2E動作検証
- **前提**: `.env.local` に `ANTHROPIC_API_KEY` 設定済みの環境
- **作業**: 実在する物件URL 2〜3件＋掲載終了URL 1件＋不正URL 1件で評価を実行し、
  ①META/REPORTの解析成功率 ②ゲージ数値の妥当性 ③フォールバック発火 ④所要時間 を記録。
  解析失敗が出る場合は `OUTPUT_FORMAT_INSTRUCTIONS`（route.ts）を調整
- **受け入れ**: 3件連続で PARSE_FAILED なし。掲載終了URLで手入力フォールバックが表示される
- **Opusへの指示文**:
  > `npm run dev` でアプリを起動し、実物件URLで /api/evaluate をE2E検証して。docs/DESIGN.md §9 の受け入れ基準に沿って結果を docs/E2E_REPORT.md にまとめ、マーカー解析が不安定ならプロンプトの出力フォーマット指示のみを改善して（ENGINE_PROMPTは触らない）。

### T-11 ⬜ スクリーンショットへの見た目合わせ
- **前提**: ユーザーから参考スクリーンショット受領（仕様書に「添付」とあるが本セッション未受領）
- **対象**: `app/globals.css`、各コンポーネントのマークアップ（構造・機能は変えない）
- **受け入れ**: 375px幅のスクリーンショット比較で配色・余白・並び順が概ね一致
- **Opusへの指示文**:
  > 添付スクリーンショットに合わせて見た目のみ調整して。信号色ルール・5セクション構成・ゲージの意味（緑帯/▼/│）は docs/DESIGN.md のまま維持。変更後に各画面のスクリーンショットを撮って比較を提示して。

### T-12 ⬜ デプロイ
- **作業**: Vercel等へデプロイ。`ANTHROPIC_API_KEY` を環境変数登録。
  `maxDuration=300` が効くプラン/設定か確認（不可なら評価APIのバックグラウンドジョブ化を提案）
- **受け入れ**: 公開URLでスマホから一連の評価が完了する
- **Opusへの指示文**:
  > このNext.jsアプリをVercelにデプロイする手順を実施して。評価APIは最大5分かかるため実行時間上限を確認し、超える場合は対応案（Edge以外のランタイム/ジョブ化）を提示してから進めて。

### T-13 ⬜（任意）ローディングの実進捗表示
- **作業**: `/api/evaluate` をSSE化し、Web検索の進行イベントを「◯◯を検索中…」としてLoadingViewに表示
- **受け入れ**: 疑似メッセージではなく実イベント由来の進捗が最低2種類表示される。失敗時は現行の擬似進捗にフォールバック

### T-14 ⬜（任意・要件変更時のみ）ログイン + DB同期
- **前提**: ユーザーが「複数端末で共有したい」と明示した場合のみ着手
- **作業**: `lib/storage.ts` と同一インターフェースのリモート実装（例: Supabase + Auth）を追加し、
  ローカル履歴のインポート機能を付ける
- **受け入れ**: 2端末で同一アカウントの履歴が一致。未ログイン時は現行のローカル動作を維持

---

## 依存関係

```
T-01 → T-02 → { T-03 → T-04 , T-05 → T-06 → T-07 } → T-08   （フェーズ1〜3: 完了）
T-09（プロンプト受領待ち）─┐
T-10（APIキー必要）────────┼→ T-12（デプロイ）
T-11（スクショ受領待ち）──┘
T-13 / T-14 は独立・任意
```
