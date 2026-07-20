"use client";

import { useEffect, useState } from "react";

/** 経過時間に応じて進捗メッセージを切り替える（評価は数分かかることがある） */
const STEPS: Array<[number, string]> = [
  [0, "物件ページを読み取っています…"],
  [20, "周辺の成約事例・相場を調べています…"],
  [60, "価格の妥当性を計算しています…"],
  [110, "交通・環境・口コミを確認しています…"],
  [170, "レポートをまとめています…"],
];

export default function LoadingView() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const step = [...STEPS].reverse().find(([sec]) => elapsed >= sec)?.[1] ?? STEPS[0][1];
  const mm = Math.floor(elapsed / 60);
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <div>
      <div className="loading-wrap">
        <div className="spinner" />
        <div className="loading-step">{step}</div>
        <div className="loading-note">
          情報収集のため2〜5分ほどかかります（経過 {mm}:{ss}）<br />
          画面を閉じずにお待ちください
        </div>
      </div>
      <div className="skeleton" />
      <div className="skeleton" />
      <div className="skeleton" style={{ height: 120 }} />
    </div>
  );
}
