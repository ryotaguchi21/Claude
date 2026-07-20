import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";
import { ENGINE_PROMPT } from "@/lib/evaluation-prompt";
import { getRecord, newServerId, upsertRecord } from "@/lib/server-store";
import type { EvalMeta, EvalRecord, EvaluateRequest } from "@/lib/types";

// 相場調査に時間がかかるため、実行時間の上限を広めに取る（Vercel等のサーバーレス用）
export const maxDuration = 300;
export const dynamic = "force-dynamic";

const MODEL = "claude-opus-4-8";
const MAX_CONTINUATIONS = 5;

/**
 * アプリ側のラッパー指示。評価ロジック本体は ENGINE_PROMPT（無改変）に委ね、
 * ここでは入出力フォーマットだけを規定する。
 */
const OUTPUT_FORMAT_INSTRUCTIONS = `
====================
■ 出力フォーマット（アプリが機械的に解析するため厳守）
====================

最終回答は必ず次の3ブロック構成で出力すること。ブロックの外に文章を書かない。

1) メタ情報ブロック（JSONのみ。コメント・末尾カンマ禁止）:
===META_START===
{
  "propertyName": "物件名",
  "verdict": "◎ | ○ | △ | × のいずれか1文字",
  "verdictLabel": "割安 | 妥当 | やや割高 | 割高",
  "summary": "判定の一言サマリ（40字以内）",
  "recommendation": "買い | 条件つき | 見送り",
  "property": {
    "name": "物件名", "address": "住所", "station": "最寄駅と徒歩分数",
    "price": "売出価格（例: 5,480万円）", "area": "専有面積（例: 70.2m²）",
    "layout": "間取り", "floor": "所在階/階建", "direction": "向き",
    "builtYear": "築年（例: 2005年築・築21年）", "totalUnits": "総戸数",
    "managementFee": "管理費（月額）", "repairFund": "修繕積立金（月額）"
  },
  "priceGauge": {
    "fairMin": 適正価格レンジ下限の数値（単位:万円）,
    "fairMax": 適正価格レンジ上限の数値（単位:万円）,
    "listPrice": 売出価格の数値（単位:万円）,
    "targetPrice": 推奨指値の数値（単位:万円）
  }
}
===META_END===
※ 不明な文字列項目は "不明"、不明な数値項目は null とする。

2) レポート本文ブロック（HTML断片のみ。<html>や<body>は不要）:
===REPORT_START===
<section class="report-section">
  <h3>📋 1. サマリ</h3>
  ...結論（買い/条件つき/見送り）・価格評価（◎○△×）・推奨する買い方・強み1つ/弱み1つ...
</section>
<section class="report-section">
  <h3>🏠 2. 物件概要</h3>
  ...名称/住所/駅徒歩/価格/面積/間取り/階/向き/築年/総戸数/管理費・修繕積立金を <dl class="spec-list"><dt>項目</dt><dd>値</dd>...</dl> で...
</section>
<section class="report-section">
  <h3>💰 3. 価格の妥当性</h3>
  ...評価（◎○△×＋一言）／適正価格レンジ／推奨指値／直近の成約情報...
</section>
<section class="report-section">
  <h3>🚃🌳💬 4. その他定性情報</h3>
  ...交通・周辺生活利便・公園自然・口コミ（各◎○△×＋1〜2行）...
</section>
<details class="detail-section">
  <summary>🔍 5. より詳細情報（タップで開く）</summary>
  <div class="detail-body">
  ...価格根拠・レンジ内訳・指値計算・利回り・再開発・学校・ハザード・総合pros/cons・出典URL一覧...
  </div>
</details>
===REPORT_END===

HTMLの決まり:
- 本文は <p>、リストは <ul><li>、項目一覧は <dl class="spec-list">、表は <table> を使う（表は5番セクション内のみ）。
- ◎○△×の評価は <span class="grade grade-good">◎ 割安</span> のように出す。
  クラス対応: ◎→grade-good / ○→grade-fair / △→grade-warn / ×→grade-bad
- 重要な金額は <strong class="big-number">5,480<small>万円</small></strong> のように強調する。
- 出典URLは <a href="..." target="_blank" rel="noopener">サイト名</a> で列挙する。
- <script> や <style> タグは絶対に使わない。

3) 物件ページが読み取れない場合（URL不正・掲載終了・アクセス不可・情報不足）:
META/REPORTを出さず、代わりに次だけを出力する。
===ERROR_START===
読み取れなかった理由を1文で
===ERROR_END===
※ 手入力の物件情報が与えられている場合はERRORにせず、その情報と周辺相場調査で評価すること。
`;

function buildUserMessage(body: EvaluateRequest): string {
  if (body.url) {
    return `次の中古マンション物件ページを取得し、内容を読み取って評価してください。\n物件URL: ${body.url}`;
  }
  const m = body.manual!;
  return [
    "物件ページが読み取れなかったため、購入検討者が手入力した以下の物件情報をもとに評価してください。",
    "Web検索で周辺相場・成約事例・環境情報を調査して評価を行うこと。",
    `- 物件名: ${m.name || "不明"}`,
    `- 住所: ${m.address || "不明"}`,
    `- 売出価格: ${m.price || "不明"}`,
    `- 専有面積: ${m.area || "不明"}`,
    `- 所在階: ${m.floor || "不明"}`,
    `- 築年: ${m.builtYear || "不明"}`,
  ].join("\n");
}

function extractBlock(text: string, name: string): string | null {
  const start = text.indexOf(`===${name}_START===`);
  const end = text.indexOf(`===${name}_END===`);
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start + `===${name}_START===`.length, end).trim();
}

/** LLM由来のHTMLから念のため script/style/イベントハンドラを除去 */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "");
}

function isValidHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  let body: EvaluateRequest;
  try {
    body = (await request.json()) as EvaluateRequest;
  } catch {
    return NextResponse.json({ error: "リクエストが不正です", code: "INVALID_URL" }, { status: 400 });
  }

  if (!body.url && !body.manual) {
    return NextResponse.json({ error: "URLまたは物件情報を入力してください", code: "INVALID_URL" }, { status: 400 });
  }
  if (body.url && !isValidHttpUrl(body.url)) {
    return NextResponse.json(
      { error: "URLの形式が正しくありません（https:// から始まるURLを入力してください）", code: "INVALID_URL" },
      { status: 400 },
    );
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "サーバーに ANTHROPIC_API_KEY が設定されていません", code: "API_ERROR" },
      { status: 500 },
    );
  }

  const client = new Anthropic();
  const system = `${ENGINE_PROMPT}\n\n${OUTPUT_FORMAT_INSTRUCTIONS}`;
  const tools = [
    { type: "web_search_20260209" as const, name: "web_search" as const, max_uses: 12 },
    { type: "web_fetch_20260209" as const, name: "web_fetch" as const, max_uses: 8 },
  ];

  let messages: Anthropic.MessageParam[] = [{ role: "user", content: buildUserMessage(body) }];

  try {
    let response = await client.messages
      .stream({
        model: MODEL,
        max_tokens: 64000,
        thinking: { type: "adaptive" },
        system,
        tools,
        messages,
      })
      .finalMessage();

    // サーバーツールの反復上限で一時停止した場合は、そのまま続行させる
    let continuations = 0;
    while (response.stop_reason === "pause_turn" && continuations < MAX_CONTINUATIONS) {
      continuations++;
      messages = [...messages, { role: "assistant", content: response.content }];
      response = await client.messages
        .stream({
          model: MODEL,
          max_tokens: 64000,
          thinking: { type: "adaptive" },
          system,
          tools,
          messages,
        })
        .finalMessage();
    }

    if (response.stop_reason === "refusal") {
      return NextResponse.json(
        { error: "この内容は評価できませんでした。別の物件でお試しください。", code: "API_ERROR" },
        { status: 422 },
      );
    }

    const fullText = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    const errorBlock = extractBlock(fullText, "ERROR");
    if (errorBlock) {
      return NextResponse.json({ error: errorBlock, code: "PAGE_UNREADABLE" }, { status: 422 });
    }

    const metaJson = extractBlock(fullText, "META");
    const reportHtml = extractBlock(fullText, "REPORT");
    if (!metaJson || !reportHtml) {
      return NextResponse.json(
        { error: "評価結果の生成に失敗しました。もう一度お試しください。", code: "PARSE_FAILED" },
        { status: 502 },
      );
    }

    let meta: EvalMeta;
    try {
      meta = JSON.parse(metaJson) as EvalMeta;
    } catch {
      return NextResponse.json(
        { error: "評価結果の解析に失敗しました。もう一度お試しください。", code: "PARSE_FAILED" },
        { status: 502 },
      );
    }

    // 共有ストアへ保存（全ユーザー共通・ログイン不要）。
    // recordId指定時は既存レコードを置換し、URLは元レコードのものを引き継ぐ。
    const prev = body.recordId ? await getRecord(body.recordId) : null;
    const record: EvalRecord = {
      id: body.recordId ?? newServerId(),
      url: body.url ?? prev?.url ?? null,
      evaluatedAt: new Date().toISOString(),
      meta,
      reportHtml: sanitizeHtml(reportHtml),
    };
    await upsertRecord(record);

    return NextResponse.json({ record });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return NextResponse.json(
        { error: "アクセスが集中しています。少し待ってからお試しください。", code: "API_ERROR" },
        { status: 429 },
      );
    }
    if (err instanceof Anthropic.APIError) {
      return NextResponse.json(
        { error: `評価サービスでエラーが発生しました（${err.status ?? "不明"}）`, code: "API_ERROR" },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: "通信エラーが発生しました。もう一度お試しください。", code: "API_ERROR" },
      { status: 500 },
    );
  }
}
