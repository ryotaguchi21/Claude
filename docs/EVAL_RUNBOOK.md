# 定期便ランブック（6時/12時/18時/24時 JST）

スケジュールされたClaudeセッションが毎回このとおりに実行する。作業ディレクトリ:
`C:\Users\ryo_t\Dropbox\Claude (WORKING)\kei-house-search\`
Python: `C:\Users\ryo_t\AppData\Local\Python\pythoncore-3.14-64\python.exe -X utf8`

## 手順

1. **キュー取り込み**: `python tools/queue.py drain`
   （アプリからのリクエストをKV→スプレッドシートへ転記）
2. **未評価の確認**: `python tools/queue.py list`
   → **0件なら何もせず終了**（ビルド・デプロイ・メールすべて不要）。
3. **各行を評価**（1件ずつ）:
   - URL先の物件情報を読み取る（WebFetch。読めない場合はWebSearchで物件名+価格を特定）。
   - `lib/evaluation-prompt.ts` の `ENGINE_PROMPT` を読み、その**基準と出力契約に完全準拠**して
     評価を実施する（WebSearch/WebFetchで相場・周辺・ハザード・履歴を調査）。
   - 出力契約どおり META(JSON) + REPORT(HTML断片) を作り、EvalRecord 形式の JSON にまとめる:
     `{"id":"ev_<epoch36>_<rand6>","url":"...","evaluatedAt":"<ISO JST>","meta":{...},"reportHtml":"..."}`
     （metaの必須: propertyName / verdict / verdictLabel / summary / recommendation / property / priceGauge。
     reportHtml に script/style/on属性を入れない）
   - 一時ファイル（スクラッチパッド）に保存 → `python tools/add_record.py <file>`
4. **反映**: `node scripts/build-static.mjs` → `npx wrangler pages deploy out --branch=main --commit-dirty=true`
5. **シート更新**: 各行 `python tools/queue.py done <行番号> https://kei-house-search.pages.dev/`
6. **コミット**: `git add data/history.json && git commit -m "定期便: <物件名> を評価 (N件)" && git push`
7. **共有**（新規評価があった場合のみ）: Ryo+Keiへ短い日本語メールで「何を評価したか・判定・アプリリンク」を通知。
   `shared.email.send_html_email`（TO=ryotaguchi21@gmail.com, CC=keitaguchi0612@gmail.com）。
   件名例: `🏠 Kei House Search: パークタワー東雲 を評価しました（◎割安）`

## 鉄則

- 評価基準・出力フォーマットの正は `lib/evaluation-prompt.ts`（無改変で従う）。
- 判定(◎○△×)と指値は必ず成約相場ベースの根拠つきで。不明項目は「不明」と書く（推測で埋めない）。
- スプレッドシートの行は**削除しない**（状態列の更新のみ）。
- 失敗した行は 状態=エラー + メモに理由を書き、次回リトライに残す。
- アプリURL: https://kei-house-search.pages.dev/ ／ シート: docs/DESIGN.md 参照。
