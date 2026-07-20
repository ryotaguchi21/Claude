/**
 * 静的書き出しビルド（Cloudflare Pages 配信用・無料枠内運用）。
 * - data/history.json → public/history.json（共有履歴を静的アセット化）
 * - app/api を一時退避して `next build`(output:export) → out/
 * - worker/_worker.js を out/ に同梱（/api/request 等の薄いAPI層）
 * Usage: node scripts/build-static.mjs
 */
import { cpSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { spawnSync } from "node:child_process";

const API_DIR = "app/api";
const TMP_DIR = "_api_disabled_tmp";

mkdirSync("public", { recursive: true });
cpSync("data/history.json", "public/history.json");

if (existsSync(TMP_DIR)) {
  throw new Error(`${TMP_DIR} が残っています。前回ビルドの後始末を確認してください。`);
}
renameSync(API_DIR, TMP_DIR);
let status = 1;
try {
  const r = spawnSync(
    process.execPath,
    ["node_modules/next/dist/bin/next", "build"],
    { stdio: "inherit", env: { ...process.env, STATIC_EXPORT: "1", NEXT_PUBLIC_STATIC: "1" } },
  );
  status = r.status ?? 1;
} finally {
  renameSync(TMP_DIR, API_DIR);
}
if (status !== 0) process.exit(status);

cpSync("worker/_worker.js", "out/_worker.js");
console.log("static build OK -> out/ (_worker.js 同梱)");
