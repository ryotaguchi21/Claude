# -*- coding: utf-8 -*-
"""Kei House Search 更新お知らせメール (docs/UPDATES.md 2026-07-20③ の内容)。
運用ルール: 変更のたびにRyoとKeiの両名へ非エンジニア向けの言葉で共有する。
Usage: python _send_update_notice.py --send
"""
import io, sys
from pathlib import Path
if getattr(sys.stdout, "encoding", "").lower() != "utf-8":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

TO = "ryotaguchi21@gmail.com"
CC = ["keitaguchi0612@gmail.com"]

CSS = "font-family:-apple-system,Segoe UI,Hiragino Kaku Gothic ProN,sans-serif;max-width:640px;margin:0 auto;color:#222;line-height:1.8;font-size:14px"

BODY = (
    f'<div style="{CSS}">'
    '<h1 style="font-size:18px">🏠 Kei House Search 更新のお知らせ（7/20 ③）</h1>'
    '<p>家さがしアプリに大きな更新が2つ入りました。</p>'

    '<h2 style="font-size:15px;border-left:4px solid #1b5e20;padding-left:8px">1. AIの評価ロジックが「本物」になりました 🧠</h2>'
    '<p>これまでアプリの中身は仮の指示書で動いていましたが、Ryoが毎日運用している'
    '物件モニタリングシステムの評価方法をそのまま移植しました。具体的には:</p>'
    '<ul style="padding-left:20px">'
    '<li>8項目・100点満点の採点（駅近さ・価格の妥当性・売りやすさ・災害リスク・再開発・建物・住戸・支払い負担）</li>'
    '<li>推奨指値の計算式（「5年住んで売ってもコストを回収して利益が残る買値」を逆算）</li>'
    '<li>同じマンションの過去の売出価格との比較チェック（周辺相場だけ見ると割安に見えてしまう罠を回避）</li>'
    '</ul>'
    '<p>これで「URLを貼って評価」した結果と、毎日の自動スキャンの候補リストが<b>同じ物差し</b>で比べられます。</p>'

    '<h2 style="font-size:15px;border-left:4px solid #1b5e20;padding-left:8px">2. 最初から評価ずみ物件が99件入っています 📚</h2>'
    '<p>アプリを開いて「📚 評価ずみ物件を見る」を押すと、いま都内で売り出し中の候補99件が'
    'スコア順に並んでいます。各物件に判定（◎○△×）・価格ゲージ・推奨指値が入っていて、'
    '「詳細評価レポート」リンクから口コミ・駅の将来性・過去の売出履歴まで見られます。</p>'

    '<h2 style="font-size:15px;border-left:4px solid #999;padding-left:8px">次にやること</h2>'
    '<ul style="padding-left:20px">'
    '<li>実際のAIキーを設定して、本物のURLでの評価テスト（T-10）</li>'
    '<li>Vercelへの公開（スマホからいつでも使えるように）（T-12）</li>'
    '</ul>'
    '<p style="color:#888;font-size:12px">更新記録はアプリ内 docs/UPDATES.md にも残しています。'
    'AIの参考情報なので、最終判断は現地見学と重要事項説明で。</p></div>'
)

if __name__ == "__main__":
    subj = "🏠 Kei House Search 更新: 本物の評価エンジン搭載＋評価ずみ99物件を収録"
    print(f"{subj} | {len(BODY.encode())//1024}KB")
    if "--send" in sys.argv:
        sys.path.insert(0, str(HERE.parent))
        from shared.bootstrap import setup
        setup()
        from shared.email import send_html_email
        r = send_html_email(subject=subj, html_body=BODY, to=TO, cc=CC)
        print(f"SENT id={r.get('id')} to {TO} cc={CC}")
