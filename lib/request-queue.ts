/**
 * 評価リクエスト送信（サブスク内運用モード）。
 * 静的ホスティング(Cloudflare Pages)では /api/request が Pages Worker 経由で
 * Cloudflare KV に積まれ、定期便(6/12/18/24時)が取り出して評価する。
 */
export async function submitRequest(url: string, requester = ""): Promise<void> {
  const res = await fetch("/api/request", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, requester }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error || "送信に失敗しました。時間をおいて再度お試しください。");
  }
}

/** 次の定期便の時刻(JST 6/12/18/24時)を「◯時」表記で返す */
export function nextRunLabel(now = new Date()): string {
  const jstHour = (now.getUTCHours() + 9) % 24;
  const slots = [0, 6, 12, 18];
  const next = slots.find((h) => h > jstHour);
  return `${next ?? 24}時`;
}
