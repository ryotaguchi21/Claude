# -*- coding: utf-8 -*-
"""評価リクエストキューの操作 (定期便 6/12/18/24時 用)。

キューは2系統:
  A) アプリ経由: Cloudflare KV (REQUESTS) — drain でスプレッドシートへ転記して消化
  B) 手動: スプレッドシート「依頼リスト」に直接URLを貼る

Usage:
  python tools/queue.py drain            # KV→シート転記(状態=受付・アプリ経由印) + KVから削除
  python tools/queue.py list             # 未評価行(状態が空 or 受付)を行番号つきで表示
  python tools/queue.py done <行番号> <結果リンク> [メモ]   # 状態=評価済み✓ に更新
Token: ../ramune-weekly-report/token.pickle (spreadsheets スコープ)
"""
import io, json, subprocess, sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
HERE = Path(__file__).resolve().parent.parent          # kei-house-search/
WS = HERE.parent                                        # Claude (WORKING)/
SHEET_ID = "1hy-beuS2f9zT2Asu_1XocZVnedlIGbq_MSrChubEXnc"
TAB = "依頼リスト"
KV_NS = "415cc5ab096e4e7bbbe4674ce9b4e359"
JST = timezone(timedelta(hours=9))


def svc():
    import pickle
    with open(WS / "ramune-weekly-report" / "token.pickle", "rb") as f:
        creds = pickle.load(f)
    if creds.expired and creds.refresh_token:
        from google.auth.transport.requests import Request
        creds.refresh(Request())
    from googleapiclient.discovery import build
    return build("sheets", "v4", credentials=creds)


def _wrangler(*args) -> str:
    r = subprocess.run(["npx.cmd" if sys.platform == "win32" else "npx", "wrangler", *args],
                       capture_output=True, text=True, cwd=HERE, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        raise RuntimeError(f"wrangler {' '.join(args)} failed: {r.stderr[-400:]}")
    return r.stdout


def drain():
    """KVの受付リクエストをシートに転記し、KVから削除。"""
    keys = json.loads(_wrangler("kv", "key", "list", f"--namespace-id={KV_NS}", "--remote") or "[]")
    reqs = []
    for k in keys:
        name = k["name"]
        if not name.startswith("req:"):
            continue
        try:
            v = json.loads(_wrangler("kv", "key", "get", name, f"--namespace-id={KV_NS}", "--remote"))
            reqs.append((name, v))
        except Exception as e:
            print(f"  skip {name}: {e}")
    if not reqs:
        print("KV: 新規リクエストなし")
        return
    s = svc()
    now = datetime.now(JST).strftime("%Y-%m-%d %H:%M")
    rows = [[v.get("url", ""), v.get("requester", "") or "アプリ", v.get("at", now)[:16].replace("T", " "),
             "受付", "", "アプリから自動追加"] for _, v in reqs]
    s.spreadsheets().values().append(
        spreadsheetId=SHEET_ID, range=f"{TAB}!A:F", valueInputOption="RAW",
        body={"values": rows}).execute()
    for name, _ in reqs:
        _wrangler("kv", "key", "delete", name, f"--namespace-id={KV_NS}", "--remote")
    print(f"KV: {len(reqs)}件をシートへ転記して消化")


def list_pending():
    s = svc()
    vals = s.spreadsheets().values().get(
        spreadsheetId=SHEET_ID, range=f"{TAB}!A2:F").execute().get("values", [])
    pend = []
    for i, row in enumerate(vals, start=2):
        url = (row[0] if len(row) > 0 else "").strip()
        status = (row[3] if len(row) > 3 else "").strip()
        if url and status in ("", "受付"):
            pend.append((i, url, row[1] if len(row) > 1 else "", row[5] if len(row) > 5 else ""))
    if not pend:
        print("未評価: 0件")
    for i, url, who, memo in pend:
        print(f"row {i} | {url} | {who} | {memo}")
    return pend


def done(row: int, link: str, memo: str = ""):
    s = svc()
    now = datetime.now(JST).strftime("%Y-%m-%d %H:%M")
    body = {"values": [["評価済み✓", link if link != "-" else "",
                        (memo + " " if memo else "") + f"評価 {now}"]]}
    s.spreadsheets().values().update(
        spreadsheetId=SHEET_ID, range=f"{TAB}!D{row}:F{row}",
        valueInputOption="RAW", body=body).execute()
    print(f"row {row}: 評価済み✓")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "list"
    if cmd == "drain":
        drain()
    elif cmd == "list":
        list_pending()
    elif cmd == "done":
        done(int(sys.argv[2]), sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else "")
    else:
        print(__doc__)
