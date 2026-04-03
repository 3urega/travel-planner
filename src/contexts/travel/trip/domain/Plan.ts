/** Fuente única de tipos de paso (schemas Zod y ejecutor deben derivar de aquí). */
export const PLAN_STEP_TYPES = [
  "search_flights",
  "search_hotels",
  "evaluate_options",
  "propose_plan",
  "simulate",
  "request_approval",
  "book_flight",
  "book_hotel",
] as const;

export type PlanStepType = (typeof PLAN_STEP_TYPES)[number];

export type PlanStepStatus =
  | "pending"
  | "in_progress"
  | "completed"
  | "blocked"
  | "failed"
  | "skipped";

export type PlanStep = {
  id: string;
  type: PlanStepType;
  description: string;
  status: PlanStepStatus;
  /** IDs de pasos de los que este depende (deben completarse antes). */
  dependsOn: string[];
  args: Record<string, unknown>;
  result?: unknown;
  approvalRequired: boolean;
};

export type Plan = {
  id: string;
  sessionId: string;
  goal: string;
  steps: PlanStep[];
  createdAt: Date;
  updatedAt: Date;
};
