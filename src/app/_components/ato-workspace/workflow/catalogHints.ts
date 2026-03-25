import type { ATOResponse } from "@/contexts/travel/trip/domain/ATOResponse";

import { findDecisionForCategory } from "./deriveWorkflowState";

const MAX_BLURB = 140;

function truncate(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Recomendación del sistema para la selección de catálogo en curso (vuelo/hotel). */
export function getCatalogRecommendation(
  response: ATOResponse,
  kind: "flight" | "hotel",
): { optionId: string; blurb: string } | null {
  const d = findDecisionForCategory(response.decisions, kind);
  if (!d?.chosenId) return null;
  return {
    optionId: String(d.chosenId),
    blurb: truncate(d.justification, MAX_BLURB),
  };
}
