"use client";

import { useState } from "react";
import type { ManualInput } from "@/lib/types";

const FIELDS: Array<{ key: keyof ManualInput; label: string; placeholder: string }> = [
  { key: "name", label: "物件名", placeholder: "例：パークハウス〇〇" },
  { key: "address", label: "住所", placeholder: "例：東京都世田谷区〇〇1-2-3" },
  { key: "price", label: "売出価格", placeholder: "例：5480万円" },
  { key: "area", label: "専有面積", placeholder: "例：70.2m²" },
  { key: "floor", label: "階", placeholder: "例：8階 / 14階建" },
  { key: "builtYear", label: "築年", placeholder: "例：2005年（築21年）" },
];

/** URL読み取り失敗時のフォールバック手入力 / 読み取り内容の修正にも使用 */
export default function ManualForm({
  title,
  note,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  title: string;
  note: string;
  initial?: Partial<ManualInput>;
  submitLabel: string;
  onSubmit: (input: ManualInput) => void;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<ManualInput>({
    name: initial?.name ?? "",
    address: initial?.address ?? "",
    price: initial?.price ?? "",
    area: initial?.area ?? "",
    floor: initial?.floor ?? "",
    builtYear: initial?.builtYear ?? "",
  });

  const canSubmit = values.address.trim() !== "" && values.price.trim() !== "";

  return (
    <div className="card">
      <h2 style={{ fontSize: 17, margin: "0 0 4px" }}>{title}</h2>
      <p className="hint" style={{ marginTop: 0 }}>{note}</p>
      {FIELDS.map(({ key, label, placeholder }) => (
        <div key={key}>
          <label className="field-label" htmlFor={`mf-${key}`}>
            {label}
            {(key === "address" || key === "price") && " （必須）"}
          </label>
          <input
            id={`mf-${key}`}
            className="text-input"
            value={values[key]}
            placeholder={placeholder}
            onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
          />
        </div>
      ))}
      <div style={{ height: 16 }} />
      <button type="button" className="btn-primary" disabled={!canSubmit} onClick={() => onSubmit(values)}>
        {submitLabel}
      </button>
      <div style={{ height: 8 }} />
      <button type="button" className="btn-ghost" style={{ width: "100%" }} onClick={onCancel}>
        キャンセル
      </button>
    </div>
  );
}
