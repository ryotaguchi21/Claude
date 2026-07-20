import type { PriceGaugeData } from "@/lib/types";

function fmt(man: number): string {
  if (man >= 10000) {
    const oku = Math.floor(man / 10000);
    const rest = Math.round(man % 10000);
    return rest > 0 ? `${oku}億${rest.toLocaleString()}` : `${oku}億`;
  }
  return man.toLocaleString();
}

/**
 * ★価格ゲージ（最重要）
 * 横棒の上に: 妥当価格レンジ=緑帯 / 売出価格=▼マーカー / 推奨指値=│縦線。
 * 売出▼が緑帯より右にあれば、文章を読まなくても「割高」と分かる。
 */
export default function PriceGauge({ data }: { data: PriceGaugeData }) {
  const { fairMin, fairMax, listPrice, targetPrice } = data;
  if (fairMin == null || fairMax == null || listPrice == null) return null;

  const values = [fairMin, fairMax, listPrice, ...(targetPrice != null ? [targetPrice] : [])];
  const span = Math.max(...values) - Math.min(...values) || Math.max(...values) * 0.1 || 1;
  const scaleMin = Math.min(...values) - span * 0.15;
  const scaleMax = Math.max(...values) + span * 0.15;
  const pos = (v: number) => `${((v - scaleMin) / (scaleMax - scaleMin)) * 100}%`;
  const width = (a: number, b: number) => `${((b - a) / (scaleMax - scaleMin)) * 100}%`;

  return (
    <div className="card gauge-card">
      <h2 className="gauge-title">💰 価格ゲージ</h2>
      <p className="hint" style={{ margin: "0 0 6px" }}>
        ▼（売出価格）が緑の帯（妥当な価格の範囲）より右にあるほど割高です
      </p>
      <div className="gauge-area">
        <div className="gauge-track">
          <div className="gauge-band" style={{ left: pos(fairMin), width: width(fairMin, fairMax) }} />
          <div className="gauge-list-marker" style={{ left: pos(listPrice) }} aria-label="売出価格">▼</div>
          {targetPrice != null && (
            <div className="gauge-target-line" style={{ left: pos(targetPrice) }} aria-label="推奨指値" />
          )}
        </div>
        <div className="gauge-scale">
          <span>{fmt(Math.round(scaleMin))}万円</span>
          <span>{fmt(Math.round(scaleMax))}万円</span>
        </div>
      </div>
      <div className="gauge-legend">
        <div className="row">
          <span className="sym">▼</span>
          <span>売出価格</span>
          <span className="num" style={{ marginLeft: "auto" }}>{fmt(listPrice)}<small>万円</small></span>
        </div>
        <div className="row">
          <span className="sym band">▬</span>
          <span>妥当価格レンジ（この範囲なら適正）</span>
        </div>
        <div className="row">
          <span className="sym band" style={{ visibility: "hidden" }}>▬</span>
          <span className="num">{fmt(fairMin)}〜{fmt(fairMax)}<small>万円</small></span>
        </div>
        {targetPrice != null && (
          <div className="row">
            <span className="sym">│</span>
            <span>推奨指値（値引き交渉の目安）</span>
            <span className="num" style={{ marginLeft: "auto" }}>{fmt(targetPrice)}<small>万円</small></span>
          </div>
        )}
      </div>
    </div>
  );
}
