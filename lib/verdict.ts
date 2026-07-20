import type { Verdict } from "./types";

/** 判定記号 → 信号色クラス（割安=緑/妥当=青/やや割高=オレンジ/割高=赤） */
export function verdictColorClass(verdict: Verdict): string {
  switch (verdict) {
    case "◎": return "v-good";
    case "○": return "v-fair";
    case "△": return "v-warn";
    case "×": return "v-bad";
    default: return "v-fair";
  }
}

export function verdictDefaultLabel(verdict: Verdict): string {
  switch (verdict) {
    case "◎": return "割安";
    case "○": return "妥当";
    case "△": return "やや割高";
    case "×": return "割高";
    default: return "";
  }
}
