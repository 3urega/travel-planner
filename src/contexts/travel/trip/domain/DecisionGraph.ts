/**
 * Autonomous Decision Graph (ADG) — modelo de grafo versionado.
 *
 * Hito 1: goal + plan_step + aristas depends_on.
 * Fase A (orquestador como productor): nodos por versión con `logical_id` estable:
 *   `simulation`, `approval:{stepId}`, `execution:{stepId}`, `decision:{decisionId}`.
 * Hitos posteriores: GraphExecutor, ramas de versión, invalidación parcial.
 */

export type AdgGraphStatus = "active" | "completed" | "failed";

export type GraphNodeType =
  | "goal"
  | "plan_step"
  | "simulation"
  | "decision"
  | "approval"
  | "execution";

export type GraphNodeStatus =
  | "pending"
  | "completed"
  | "blocked"
  | "failed"
  | "skipped";

export type GraphEdgeType = "depends_on" | "produces" | "influences";

/** Identificador lógico estable: `"goal"` o el `PlanStep.id` del plan. */
export type GraphLogicalId = string;

export type AdgGraph = {
  id: string;
  sessionId: string;
  planId: string;
  goal: string;
  status: AdgGraphStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type AdgGraphVersion = {
  id: string;
  graphId: string;
  versionNumber: number;
  parentVersionId: string | null;
  createdAt: Date;
};

export type AdgGraphNode = {
  id: string;
  graphVersionId: string;
  nodeType: GraphNodeType;
  status: GraphNodeStatus;
  /** `"goal"` o id del paso del plan. */
  logicalId: GraphLogicalId;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export type AdgGraphEdge = {
  id: string;
  graphVersionId: string;
  fromNodeId: string;
  toNodeId: string;
  edgeType: GraphEdgeType;
  createdAt: Date;
};

export type PersistedPlanGraph = {
  graphId: string;
  graphVersionId: string;
};
