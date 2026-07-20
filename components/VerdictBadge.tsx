import type { EvalMeta } from "@/lib/types";
import { verdictColorClass, verdictDefaultLabel } from "@/lib/verdict";

/** 信号色の大きな判定バッジ（◎○△×＋一言） */
export default function VerdictBadge({ meta }: { meta: EvalMeta }) {
  const label = meta.verdictLabel || verdictDefaultLabel(meta.verdict);
  return (
    <div className={`verdict-badge ${verdictColorClass(meta.verdict)}`}>
      <div>
        <span className="mark">{meta.verdict}</span>
        <span className="label">{label}</span>
      </div>
      <div className="word">{meta.summary}</div>
    </div>
  );
}
