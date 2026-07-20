# -*- coding: utf-8 -*-
"""EvalRecord JSON を data/history.json へ upsert する (定期便用)。

Usage:
  python tools/add_record.py <record.json>       # 1件(オブジェクト) or 複数(配列)
必須キー: id / meta / reportHtml。同一idは置換。url重複(同一URLの旧評価)は新しい方で置換。
"""
import io, json, sys
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
HERE = Path(__file__).resolve().parent.parent
FILE = HERE / "data" / "history.json"


def main(path: str):
    incoming = json.loads(Path(path).read_text(encoding="utf-8"))
    if isinstance(incoming, dict):
        incoming = [incoming]
    records = json.loads(FILE.read_text(encoding="utf-8")) if FILE.exists() else []
    by_id = {r["id"]: i for i, r in enumerate(records)}
    by_url = {r.get("url"): i for i, r in enumerate(records) if r.get("url")}
    added = replaced = 0
    for r in incoming:
        if not (isinstance(r, dict) and r.get("id") and r.get("meta") and isinstance(r.get("reportHtml"), str)):
            print(f"  skip(必須キー不足): {str(r)[:80]}")
            continue
        idx = by_id.get(r["id"])
        if idx is None and r.get("url"):
            idx = by_url.get(r["url"])  # 同一URLの再評価は置換
        if idx is not None:
            records[idx] = r
            replaced += 1
        else:
            records.append(r)
            by_id[r["id"]] = len(records) - 1
            added += 1
    FILE.write_text(json.dumps(records, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"history.json: +{added} / 置換{replaced} / 計{len(records)}件")


if __name__ == "__main__":
    main(sys.argv[1])
