/**
 * Cloudflare Pages 用ワーカー（静的アプリの薄いAPI層・無料枠内）。
 * - POST /api/request : 評価リクエストを KV(REQUESTS) に積む → 定期便が取り出して評価
 * - GET  /api/history : 同梱の /history.json（定期便が更新して再デプロイ）を共有履歴として返す
 * - POST/DELETE /api/history : 静的運用では不可のため no-op（アプリ互換のため200を返す）
 * - POST /api/evaluate : その場評価はサブスク内運用のため停止中 → 案内を返す
 */

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);

    if (url.pathname === "/api/request" && req.method === "POST") {
      const data = await req.json().catch(() => ({}));
      const propertyUrl = (data.url || "").trim();
      if (!/^https?:\/\/.+\..+/.test(propertyUrl)) {
        return json({ error: "物件ページのURLを入力してください" }, 400);
      }
      const id = `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
      await env.REQUESTS.put(
        `req:${id}`,
        JSON.stringify({
          url: propertyUrl,
          requester: String(data.requester || "").slice(0, 40),
          at: new Date().toISOString(),
        }),
        { expirationTtl: 60 * 60 * 24 * 30 },
      );
      return json({ ok: true });
    }

    if (url.pathname === "/api/history") {
      if (req.method === "GET") {
        const res = await env.ASSETS.fetch(new URL("/history.json", url));
        const records = res.ok ? await res.json().catch(() => []) : [];
        return json({ records: Array.isArray(records) ? records : [] });
      }
      return json({ ok: true }); // POST(移行)/DELETE は静的運用では no-op
    }

    if (url.pathname === "/api/evaluate") {
      return json(
        { error: "この画面での即時評価は停止中です。URLは受付キューに送信してください。", code: "QUEUED_MODE" },
        501,
      );
    }

    return env.ASSETS.fetch(req);
  },
};
