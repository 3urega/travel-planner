import type { ResolvedUserTravelPreferences } from "../../../domain/UserTravelPreferences";

export function buildStandardTravelPlanUserContent(
  userMessage: string,
  prefs?: ResolvedUserTravelPreferences,
  gatheredSlots?: Record<string, string>,
): string {
  const parts: string[] = [userMessage.trim()];

  if (prefs) {
    const lines: string[] = [];
    if (prefs.maxPriceUsd !== undefined) {
      lines.push(
        `Approximate maximum budget: ${prefs.maxPriceUsd} USD (use for searches and cost-aware steps).`,
      );
    }
    lines.push(
      `Price vs comfort weights: ${Math.round(prefs.weights.price * 100)}% price / ${Math.round(prefs.weights.comfort * 100)}% comfort.`,
    );
    parts.push(`\n\n[User preferences]\n${lines.join(" ")}`);
  }

  if (gatheredSlots && Object.keys(gatheredSlots).length > 0) {
    parts.push(
      "\n\n[Gathered travel data — use these values in plan steps; do NOT ask for them again]",
    );
    for (const [k, v] of Object.entries(gatheredSlots)) {
      if (v.trim() !== "") parts.push(`${k}: ${v}`);
    }
  }

  return parts.join("\n");
}

export function buildConfirmedDatesUserContent(
  userMessage: string,
  prefs: ResolvedUserTravelPreferences | undefined,
  gatheredSlots: Record<string, string> | undefined,
): string {
  const slotBlock =
    gatheredSlots && Object.keys(gatheredSlots).length > 0
      ? Object.entries(gatheredSlots)
          .filter(([, v]) => v.trim() !== "")
          .map(([k, v]) => `${k}: ${v}`)
          .join("\n")
      : "";
  const lines: string[] = [userMessage.trim(), ""];
  lines.push("[CONFIRMED travel data — mandatory values for plan steps]");
  lines.push(slotBlock || "(none)");
  if (prefs) {
    lines.push("");
    lines.push("[User preferences]");
    if (prefs.maxPriceUsd !== undefined) {
      lines.push(`Approximate maximum budget: ${prefs.maxPriceUsd} USD.`);
    }
    lines.push(
      `Price vs comfort weights: ${Math.round(prefs.weights.price * 100)}% price / ${Math.round(prefs.weights.comfort * 100)}% comfort.`,
    );
  }
  return lines.join("\n");
}
