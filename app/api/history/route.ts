import { NextResponse } from "next/server";
import { importRecords, listRecords, removeRecord } from "@/lib/server-store";
import type { EvalRecord } from "@/lib/types";

export const dynamic = "force-dynamic";

/** 共有履歴の取得（全ユーザー共通・ログイン不要） */
export async function GET() {
  const records = await listRecords();
  return NextResponse.json({ records });
}

/** 一括登録: 旧localStorage履歴の移行や、評価済みデータのシード投入に使う */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { records?: EvalRecord[] };
    if (!Array.isArray(body.records)) {
      return NextResponse.json({ error: "records配列が必要です" }, { status: 400 });
    }
    const added = await importRecords(body.records);
    return NextResponse.json({ added });
  } catch {
    return NextResponse.json({ error: "リクエストが不正です" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "idが必要です" }, { status: 400 });
  const removed = await removeRecord(id);
  return NextResponse.json({ removed });
}
