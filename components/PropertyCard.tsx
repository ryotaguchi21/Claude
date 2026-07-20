import type { PropertyInfo } from "@/lib/types";

const FIELDS: Array<[keyof PropertyInfo, string]> = [
  ["name", "物件名"],
  ["address", "住所"],
  ["station", "駅徒歩"],
  ["price", "売出価格"],
  ["area", "専有面積"],
  ["layout", "間取り"],
  ["floor", "所在階"],
  ["direction", "向き"],
  ["builtYear", "築年"],
  ["totalUnits", "総戸数"],
  ["managementFee", "管理費"],
  ["repairFund", "修繕積立金"],
];

/** 読み取り確認カード（評価結果の最上部） */
export default function PropertyCard({
  property,
  onCorrect,
}: {
  property: PropertyInfo;
  onCorrect: () => void;
}) {
  return (
    <div className="card confirm-card">
      <h2 className="confirm-title">📄 読み取った物件情報</h2>
      <dl className="spec-grid">
        {FIELDS.map(([key, label]) => (
          <FieldRow key={key} label={label} value={property?.[key]} />
        ))}
      </dl>
      <p className="confirm-note">内容が違う場合は正しい情報を入力してください。</p>
      <button type="button" className="btn-secondary" onClick={onCorrect}>
        内容を修正して再評価する
      </button>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value?: string }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{value || "不明"}</dd>
    </>
  );
}
