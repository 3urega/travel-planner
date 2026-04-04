import type { ApprovalLevel } from "./ApprovalPolicy";
import type { DecisionRecord } from "./DecisionRecord";
import type { Plan, PlanStep } from "./Plan";

/** Misma forma que `PendingApprovalItem` en ATOResponse (evita ciclo de imports). */
export type CheckpointPendingApproval = {
  stepId: string;
  stepType: string;
  description: string;
  level: ApprovalLevel;
  reason: string;
  estimatedCost?: number;
  args: Record<string, unknown>;
};

export const GRAPH_CHECKPOINT_PREF_KEY = "graphExecutionCheckpoint";
export const CHECKPOINT_PLAN_PREF_KEY = "checkpointPlan";
export const ADG_GRAPH_ID_PREF_KEY = "checkpointAdgGraphId";

/** Metadatos opcionales para tarjetas de selección (p. ej. vuelo); sin acoplar a un proveedor. */
export type SelectionOptionFlightDetail = {
  airline?: string;
  departureTime?: string;
  arrivalTime?: string;
  stops?: number;
  durationMinutes?: number;
};

export type SelectionOptionPayload = {
  id: string;
  label: string;
  priceUsd?: number;
  detail?: SelectionOptionFlightDetail;
};

export type AwaitingSelectionPayload = {
  stepId: string;
  decisionId: string;
  selectionRequestLogicalId: string;
  selectionKind: "flight" | "hotel";
  title: string;
  options: SelectionOptionPayload[];
};

export type GraphExecutionCheckpoint = {
  graphVersionId: string;
  graphId?: string;
  fullyCompletedStepIds: string[];
  partialDecisions: DecisionRecord[];
  partialExecutedSteps: Array<{ stepId: string; result: unknown }>;
  partialPendingApprovals: CheckpointPendingApproval[];
  awaitingSelection?: AwaitingSelectionPayload;
};

export type PendingSelectionItem = AwaitingSelectionPayload;

function isPlanStep(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === "object" && raw !== null && "id" in raw && "type" in raw;
}

export function planToPreferenceJson(plan: Plan): Record<string, unknown> {
  return {
    ...plan,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt.toISOString(),
    steps: plan.steps.map((s) => planStepToJson(s)),
  };
}

function planStepToJson(step: PlanStep): Record<string, unknown> {
  const o: Record<string, unknown> = {
    id: step.id,
    type: step.type,
    description: step.description,
    status: step.status,
    dependsOn: step.dependsOn,
    args: step.args,
    approvalRequired: step.approvalRequired,
  };
  if (step.result !== undefined) o.result = step.result;
  return o;
}

export function planFromPreferenceJson(raw: unknown): Plan | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : null;
  const sessionId = typeof o.sessionId === "string" ? o.sessionId : null;
  const goal = typeof o.goal === "string" ? o.goal : null;
  if (!id || !sessionId || !goal) return null;
  const createdAt =
    typeof o.createdAt === "string" ? new Date(o.createdAt) : null;
  const updatedAt =
    typeof o.updatedAt === "string" ? new Date(o.updatedAt) : null;
  if (!createdAt || !updatedAt || Number.isNaN(+createdAt)) return null;
  if (!Array.isArray(o.steps)) return null;
  const steps: PlanStep[] = [];
  for (const s of o.steps) {
    if (!isPlanStep(s)) return null;
    const dep = s.dependsOn;
    if (!Array.isArray(dep) || !dep.every((x) => typeof x === "string"))
      return null;
    steps.push({
      id: String(s.id),
      type: s.type as PlanStep["type"],
      description: String(s.description ?? ""),
      status: s.status as PlanStep["status"],
      dependsOn: dep as string[],
      args: typeof s.args === "object" && s.args !== null ? (s.args as Record<string, unknown>) : {},
      approvalRequired: Boolean(s.approvalRequired),
      result: s.result,
    });
  }
  return {
    id,
    sessionId,
    goal,
    steps,
    createdAt,
    updatedAt,
  };
}

function decisionFromJson(raw: unknown): DecisionRecord | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.id !== "string" || typeof o.sessionId !== "string") return null;
  const createdAt =
    typeof o.createdAt === "string" ? new Date(o.createdAt) : new Date();
  if (typeof o.category !== "string" || !Array.isArray(o.options))
    return null;
  return {
    id: o.id,
    sessionId: o.sessionId,
    category: o.category,
    options: o.options as DecisionRecord["options"],
    chosenId: String(o.chosenId ?? ""),
    userChosenId:
      o.userChosenId !== undefined ? String(o.userChosenId) : undefined,
    justification: String(o.justification ?? ""),
    weights: o.weights as DecisionRecord["weights"],
    createdAt,
  };
}

export function checkpointToPreferenceJson(
  c: GraphExecutionCheckpoint,
): Record<string, unknown> {
  return {
    graphVersionId: c.graphVersionId,
    ...(c.graphId !== undefined && { graphId: c.graphId }),
    fullyCompletedStepIds: c.fullyCompletedStepIds,
    partialDecisions: c.partialDecisions.map(decisionToJson),
    partialExecutedSteps: c.partialExecutedSteps,
    partialPendingApprovals: c.partialPendingApprovals,
    ...(c.awaitingSelection !== undefined && {
      awaitingSelection: c.awaitingSelection,
    }),
  };
}

function decisionToJson(d: DecisionRecord): Record<string, unknown> {
  return {
    ...d,
    createdAt: d.createdAt.toISOString(),
  };
}

export function checkpointFromPreferenceJson(
  raw: unknown,
): GraphExecutionCheckpoint | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.graphVersionId !== "string") return null;
  const fully = o.fullyCompletedStepIds;
  if (!Array.isArray(fully) || !fully.every((x) => typeof x === "string"))
    return null;
  const partialDecRaw = o.partialDecisions;
  if (!Array.isArray(partialDecRaw)) return null;
  const partialDecisions: DecisionRecord[] = [];
  for (const p of partialDecRaw) {
    const d = decisionFromJson(p);
    if (!d) return null;
    partialDecisions.push(d);
  }
  const pEx = o.partialExecutedSteps;
  if (!Array.isArray(pEx)) return null;
  const partialExecutedSteps: Array<{ stepId: string; result: unknown }> = [];
  for (const row of pEx) {
    if (typeof row !== "object" || row === null) return null;
    const r = row as Record<string, unknown>;
    if (typeof r.stepId !== "string") return null;
    partialExecutedSteps.push({ stepId: r.stepId, result: r.result });
  }
  const pAp = o.partialPendingApprovals;
  if (!Array.isArray(pAp)) return null;

  let awaitingSelection: AwaitingSelectionPayload | undefined;
  if (o.awaitingSelection !== undefined) {
    const a = o.awaitingSelection as Record<string, unknown>;
    if (
      typeof a.stepId !== "string" ||
      typeof a.decisionId !== "string" ||
      typeof a.selectionRequestLogicalId !== "string" ||
      typeof a.selectionKind !== "string" ||
      typeof a.title !== "string" ||
      !Array.isArray(a.options)
    ) {
      return null;
    }
    awaitingSelection = {
      stepId: a.stepId,
      decisionId: a.decisionId,
      selectionRequestLogicalId: a.selectionRequestLogicalId,
      selectionKind: a.selectionKind as AwaitingSelectionPayload["selectionKind"],
      title: a.title,
      options: a.options as SelectionOptionPayload[],
    };
  }

  return {
    graphVersionId: o.graphVersionId,
    graphId: typeof o.graphId === "string" ? o.graphId : undefined,
    fullyCompletedStepIds: fully,
    partialDecisions,
    partialExecutedSteps,
    partialPendingApprovals: pAp as CheckpointPendingApproval[],
    awaitingSelection,
  };
}

export function readCheckpointFromPreferences(
  prefs: Record<string, unknown>,
): GraphExecutionCheckpoint | null {
  const raw = prefs[GRAPH_CHECKPOINT_PREF_KEY];
  return checkpointFromPreferenceJson(raw);
}
