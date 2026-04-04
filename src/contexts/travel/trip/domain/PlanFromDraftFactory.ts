import crypto from "crypto";

import type { Plan, PlanStep } from "./Plan";
import type { PlannerGenerateResult } from "./PlannerResult";
import type { TravelPlanDraftStep } from "./TravelPlanDraftOutcome";

/** Cada `search_hotels` debe depender (transitivamente) de algún `search_flights`. */
function flightHotelDependencyValid(steps: TravelPlanDraftStep[]): boolean {
  const flightIds = new Set(
    steps.filter((s) => s.type === "search_flights").map((s) => s.id),
  );
  const hasHotel = steps.some((s) => s.type === "search_hotels");
  if (hasHotel && flightIds.size === 0) return false;

  const byId = new Map(steps.map((s) => [s.id, s]));
  for (const s of steps) {
    if (s.type !== "search_hotels") continue;
    const stack = [...s.dependsOn];
    const seen = new Set<string>();
    let reachesFlight = false;
    while (stack.length > 0) {
      const id = stack.pop()!;
      if (seen.has(id)) continue;
      seen.add(id);
      if (flightIds.has(id)) {
        reachesFlight = true;
        break;
      }
      const dep = byId.get(id);
      if (dep) stack.push(...dep.dependsOn);
    }
    if (!reachesFlight) return false;
  }
  return true;
}

function stepIdsAreUnique(steps: { id: string }[]): boolean {
  const ids = steps.map((s) => s.id.trim()).filter((id) => id.length > 0);
  return new Set(ids).size === ids.length;
}

function dependsOnReferencesAreValid(
  steps: { id: string; dependsOn: string[] }[],
): boolean {
  const idSet = new Set(steps.map((s) => s.id));
  for (const s of steps) {
    if (!s.id.trim()) return false;
    for (const d of s.dependsOn) {
      if (!idSet.has(d)) return false;
    }
  }
  return true;
}

/**
 * Ensambla un agregado `Plan` desde un cuerpo de borrador validado por el adaptador LLM
 * y aplica invariantes (reservas con aprobación, coherencia de dependsOn).
 */
export function planFromValidatedDraftBody(
  sessionId: string,
  body: { goal: string; steps: TravelPlanDraftStep[] },
): PlannerGenerateResult | null {
  const { goal, steps: rawSteps } = body;
  if (!goal.trim()) return null;
  if (rawSteps.length === 0) return null;
  if (!stepIdsAreUnique(rawSteps)) return null;
  if (!dependsOnReferencesAreValid(rawSteps)) return null;
  if (!flightHotelDependencyValid(rawSteps)) return null;

  const now = new Date();
  const steps: PlanStep[] = rawSteps.map((s) => {
    const requiresBookingApproval =
      s.type === "book_flight" || s.type === "book_hotel";
    return {
      id: s.id,
      type: s.type,
      description: s.description,
      status: "pending",
      dependsOn: s.dependsOn,
      args: s.args,
      approvalRequired: requiresBookingApproval ? true : s.approvalRequired,
    };
  });

  const plan: Plan = {
    id: crypto.randomUUID(),
    sessionId,
    goal: goal.trim(),
    steps,
    createdAt: now,
    updatedAt: now,
  };

  return { kind: "plan", plan };
}
