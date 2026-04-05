import crypto from "crypto";

import type { Plan, PlanStep } from "./Plan";
import type { PlannerGenerateResult } from "./PlannerResult";
import type { TravelPlanDraftStep } from "./TravelPlanDraftOutcome";
import { TravelGoalCities } from "./TravelGoalCities";

/** Valores típicos del LLM cuando no copia ciudades reales en `search_flights.args`. */
function isPlaceholderRouteToken(value: string): boolean {
  const t = value.trim();
  if (t.length === 0) return true;
  return /^(origin|destination)$/i.test(t);
}

/** Sustituye `from`/`to` ficticios por la heurística aplicada al `goal` del plan. */
function applyInferredCitiesToFlightSteps(
  steps: PlanStep[],
  goalText: string,
): void {
  const inferred = TravelGoalCities.inferFromGoal(goalText);
  for (const s of steps) {
    if (s.type !== "search_flights") continue;
    const args = s.args as Record<string, unknown>;
    const fromRaw = String(args.from ?? "").trim();
    const toRaw = String(args.to ?? "").trim();
    if (isPlaceholderRouteToken(fromRaw)) {
      args.from = inferred.from;
    }
    if (isPlaceholderRouteToken(toRaw)) {
      args.to = inferred.to;
    }
  }
}

function firstGatheredValue(
  gathered: Record<string, string>,
  keys: string[],
): string | undefined {
  for (const k of keys) {
    const v = gathered[k]?.trim();
    if (v) return v;
  }
  return undefined;
}

/**
 * Aplica slots ya recogidos (POST / recuperación). `recovery_*` siempre gana sobre lo que puso el LLM.
 */
function applyGatheredSlotsToFlightSteps(
  steps: PlanStep[],
  gathered?: Record<string, string>,
): void {
  if (!gathered || Object.keys(gathered).length === 0) return;

  const recoveryOrigin = firstGatheredValue(gathered, ["recovery_origin"]);
  const recoveryDest = firstGatheredValue(gathered, ["recovery_destination"]);
  const plainOrigin = firstGatheredValue(gathered, ["origin"]);
  const plainDest = firstGatheredValue(gathered, ["destination"]);

  for (const s of steps) {
    if (s.type !== "search_flights") continue;
    const args = s.args as Record<string, unknown>;

    if (recoveryOrigin) {
      args.from = recoveryOrigin;
    } else if (plainOrigin) {
      const fromRaw = String(args.from ?? "").trim();
      if (isPlaceholderRouteToken(fromRaw)) {
        args.from = plainOrigin;
      }
    }

    if (recoveryDest) {
      args.to = recoveryDest;
    } else if (plainDest) {
      const toRaw = String(args.to ?? "").trim();
      if (isPlaceholderRouteToken(toRaw)) {
        args.to = plainDest;
      }
    }

    const recoveryDate = firstGatheredValue(gathered, [
      "recovery_outbound",
      "outbound",
      "outbound_date",
    ]);
    if (
      recoveryDate &&
      /^\d{4}-\d{2}-\d{2}$/.test(recoveryDate.trim())
    ) {
      args.date = recoveryDate.trim();
    }

    const allowConn = firstGatheredValue(gathered, [
      "recovery_allow_connections",
    ]);
    if (allowConn === "yes" || allowConn === "1") {
      args.non_stop = false;
    }
  }
}

function gatherHintsForRouteInference(
  gathered?: Record<string, string>,
): string[] {
  if (!gathered || Object.keys(gathered).length === 0) return [];
  const out: string[] = [];
  const ro =
    firstGatheredValue(gathered, ["recovery_origin", "origin"]);
  const rd =
    firstGatheredValue(gathered, ["recovery_destination", "destination"]);
  if (ro) out.push(`Origen confirmado: ${ro}`);
  if (rd) out.push(`Destino confirmado: ${rd}`);
  return out;
}

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

export type PlanFromValidatedDraftOptions = {
  /** Narrativa original; si el LLM deja `Origin`/`Destination`, se infiere ruta desde aquí + goal */
  routeInferenceText?: string;
  /** Slots del usuario (p. ej. recovery_origin); se fusionan en `search_flights` tras la inferencia por texto */
  gatheredSlots?: Record<string, string>;
};

/**
 * Ensambla un agregado `Plan` desde un cuerpo de borrador validado por el adaptador LLM
 * y aplica invariantes (reservas con aprobación, coherencia de dependsOn).
 */
export function planFromValidatedDraftBody(
  sessionId: string,
  body: { goal: string; steps: TravelPlanDraftStep[] },
  options?: PlanFromValidatedDraftOptions,
): PlannerGenerateResult | null {
  const { goal, steps: rawSteps } = body;
  if (!goal.trim()) return null;
  if (rawSteps.length === 0) return null;
  if (!stepIdsAreUnique(rawSteps)) return null;
  if (!dependsOnReferencesAreValid(rawSteps)) return null;
  if (!flightHotelDependencyValid(rawSteps)) return null;

  const routeInferenceSource = [
    options?.routeInferenceText?.trim(),
    ...gatherHintsForRouteInference(options?.gatheredSlots),
    goal.trim(),
  ]
    .filter((s): s is string => typeof s === "string" && s.length > 0)
    .join(" · ");

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

  applyInferredCitiesToFlightSteps(
    steps,
    routeInferenceSource.length > 0 ? routeInferenceSource : goal.trim(),
  );
  applyGatheredSlotsToFlightSteps(steps, options?.gatheredSlots);

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
