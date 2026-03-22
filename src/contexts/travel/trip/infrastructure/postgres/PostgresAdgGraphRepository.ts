import crypto from "crypto";

import { Service } from "diod";

import { PostgresPool } from "@/contexts/shared/infrastructure/postgres/PostgresPool";
import type { GraphNodeStatus, PersistedPlanGraph } from "../../domain/DecisionGraph";
import type { ApprovalLevel } from "../../domain/ApprovalPolicy";
import type { DecisionRecord } from "../../domain/DecisionRecord";
import type { Plan, PlanStepStatus } from "../../domain/Plan";
import type { SimulationResult } from "../../domain/SimulationResult";

const GOAL_LOGICAL_ID = "goal";
const SIMULATION_LOGICAL_ID = "simulation";

function approvalLogicalId(stepId: string): string {
  return `approval:${stepId}`;
}

function executionLogicalId(stepId: string): string {
  return `execution:${stepId}`;
}

function decisionLogicalId(decisionId: string): string {
  return `decision:${decisionId}`;
}

/** El CHECK de `adg_graph_node.status` no incluye `in_progress` del plan. */
function toGraphNodeStatus(stepStatus: PlanStepStatus): GraphNodeStatus {
  if (stepStatus === "in_progress") return "pending";
  return stepStatus;
}

/**
 * Persistencia del ADG: Hito 1 (plan) + Fase A (simulation / approval / execution / decision).
 */
@Service()
export class PostgresAdgGraphRepository {
  constructor(private readonly pool: PostgresPool) {}

  private async loadLogicalIdToNodeId(
    graphVersionId: string,
    logicalIds: string[],
  ): Promise<Map<string, string> | null> {
    if (logicalIds.length === 0) return new Map();
    const res = await this.pool.get().query<{ logical_id: string; id: string }>(
      `SELECT logical_id, id FROM adg_graph_node
       WHERE graph_version_id = $1 AND logical_id = ANY($2::text[])`,
      [graphVersionId, logicalIds],
    );
    const map = new Map<string, string>();
    for (const row of res.rows) {
      map.set(row.logical_id, row.id);
    }
    if (map.size !== logicalIds.length) return null;
    return map;
  }

  /**
   * Fase A: nodo `simulation` con resultado de simulación.
   * Aristas: cada `plan_step` --produces--> simulation; simulation --depends_on--> goal.
   */
  async appendSimulationRun(
    graphVersionId: string,
    plan: Plan,
    simulation: SimulationResult,
  ): Promise<boolean> {
    const logicalIds = [GOAL_LOGICAL_ID, ...plan.steps.map((s) => s.id)];
    const idMap = await this.loadLogicalIdToNodeId(graphVersionId, logicalIds);
    if (!idMap) {
      console.error(
        "[PostgresAdgGraphRepository] appendSimulationRun: nodos plan no encontrados",
      );
      return false;
    }

    const client = await this.pool.get().connect();
    const now = new Date();
    try {
      await client.query("BEGIN");

      const simNodeId = crypto.randomUUID();
      const simOutput = {
        planId: simulation.planId,
        totalEstimatedCost: simulation.totalEstimatedCost,
        breakdown: simulation.breakdown,
        dependencyConflicts: simulation.dependencyConflicts,
        feasible: simulation.feasible,
        humanSummary: simulation.humanSummary,
      };

      await client.query(
        `INSERT INTO adg_graph_node
           (id, graph_version_id, node_type, status, logical_id, input, output, metadata, created_at)
         VALUES ($1, $2, 'simulation', 'completed', $3, '{}'::jsonb, $4::jsonb, $5::jsonb, $6)`,
        [
          simNodeId,
          graphVersionId,
          SIMULATION_LOGICAL_ID,
          JSON.stringify(simOutput),
          JSON.stringify({ phase: "simulation" }),
          now,
        ],
      );

      const goalId = idMap.get(GOAL_LOGICAL_ID)!;
      await client.query(
        `INSERT INTO adg_graph_edge (id, graph_version_id, from_node_id, to_node_id, edge_type, created_at)
         VALUES ($1, $2, $3, $4, 'depends_on', $5)`,
        [crypto.randomUUID(), graphVersionId, simNodeId, goalId, now],
      );

      for (const step of plan.steps) {
        const stepNodeId = idMap.get(step.id);
        if (!stepNodeId) continue;
        await client.query(
          `INSERT INTO adg_graph_edge (id, graph_version_id, from_node_id, to_node_id, edge_type, created_at)
           VALUES ($1, $2, $3, $4, 'produces', $5)`,
          [crypto.randomUUID(), graphVersionId, stepNodeId, simNodeId, now],
        );
      }

      await client.query("COMMIT");
      return true;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[PostgresAdgGraphRepository] appendSimulationRun failed:", err);
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Fase A: nodo de política de aprobación por paso.
   * Arista: plan_step --influences--> approval.
   */
  async appendApprovalForStep(
    graphVersionId: string,
    stepId: string,
    level: ApprovalLevel,
    reason: string,
    estimatedCost: number | undefined,
  ): Promise<boolean> {
    const idMap = await this.loadLogicalIdToNodeId(graphVersionId, [
      stepId,
    ]);
    if (!idMap?.has(stepId)) {
      console.error(
        `[PostgresAdgGraphRepository] appendApprovalForStep: plan_step no encontrado (${stepId})`,
      );
      return false;
    }

    const client = await this.pool.get().connect();
    const now = new Date();
    const status: GraphNodeStatus =
      level === "auto" ? "completed" : level === "blocked" ? "failed" : "blocked";

    try {
      await client.query("BEGIN");

      const apprId = crypto.randomUUID();
      const logical = approvalLogicalId(stepId);
      await client.query(
        `INSERT INTO adg_graph_node
           (id, graph_version_id, node_type, status, logical_id, input, output, metadata, created_at)
         VALUES ($1, $2, 'approval', $3, $4, $5::jsonb, NULL, $6::jsonb, $7)`,
        [
          apprId,
          graphVersionId,
          status,
          logical,
          JSON.stringify({
            level,
            reason,
            estimatedCost: estimatedCost ?? null,
          }),
          JSON.stringify({ phase: "approval" }),
          now,
        ],
      );

      const stepNodeId = idMap.get(stepId)!;
      await client.query(
        `INSERT INTO adg_graph_edge (id, graph_version_id, from_node_id, to_node_id, edge_type, created_at)
         VALUES ($1, $2, $3, $4, 'influences', $5)`,
        [crypto.randomUUID(), graphVersionId, stepNodeId, apprId, now],
      );

      await client.query("COMMIT");
      return true;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[PostgresAdgGraphRepository] appendApprovalForStep failed:", err);
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Fase A: ejecución de tool (mock/real) por paso.
   * Aristas: execution --depends_on--> approval; execution --depends_on--> plan_step.
   */
  async appendExecutionForStep(
    graphVersionId: string,
    stepId: string,
    toolType: string,
    args: Record<string, unknown>,
    success: boolean,
    resultData: unknown,
    errorMessage: string | undefined,
  ): Promise<boolean> {
    const idMap = await this.loadLogicalIdToNodeId(graphVersionId, [
      stepId,
      approvalLogicalId(stepId),
    ]);
    if (!idMap?.has(stepId) || !idMap.has(approvalLogicalId(stepId))) {
      console.error(
        "[PostgresAdgGraphRepository] appendExecutionForStep: nodos prerequisito no encontrados",
      );
      return false;
    }

    const client = await this.pool.get().connect();
    const now = new Date();
    const status: GraphNodeStatus = success ? "completed" : "failed";

    try {
      await client.query("BEGIN");

      const execId = crypto.randomUUID();
      const logical = executionLogicalId(stepId);
      const outputPayload = success
        ? { result: resultData }
        : { error: errorMessage ?? "unknown" };

      await client.query(
        `INSERT INTO adg_graph_node
           (id, graph_version_id, node_type, status, logical_id, input, output, metadata, created_at)
         VALUES ($1, $2, 'execution', $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8)`,
        [
          execId,
          graphVersionId,
          status,
          logical,
          JSON.stringify({ toolType, args }),
          JSON.stringify(outputPayload),
          JSON.stringify({ phase: "execution" }),
          now,
        ],
      );

      const stepNodeId = idMap.get(stepId)!;
      const apprNodeId = idMap.get(approvalLogicalId(stepId))!;
      await client.query(
        `INSERT INTO adg_graph_edge (id, graph_version_id, from_node_id, to_node_id, edge_type, created_at)
         VALUES ($1, $2, $3, $4, 'depends_on', $5)`,
        [crypto.randomUUID(), graphVersionId, execId, apprNodeId, now],
      );
      await client.query(
        `INSERT INTO adg_graph_edge (id, graph_version_id, from_node_id, to_node_id, edge_type, created_at)
         VALUES ($1, $2, $3, $4, 'depends_on', $5)`,
        [crypto.randomUUID(), graphVersionId, execId, stepNodeId, now],
      );

      await client.query("COMMIT");
      return true;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[PostgresAdgGraphRepository] appendExecutionForStep failed:", err);
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Fase A: decisión por scoring (p. ej. vuelo/hotel).
   * Arista: decision --depends_on--> execution.
   */
  async appendDecisionForStep(
    graphVersionId: string,
    stepId: string,
    decision: DecisionRecord,
  ): Promise<boolean> {
    const idMap = await this.loadLogicalIdToNodeId(graphVersionId, [
      executionLogicalId(stepId),
    ]);
    if (!idMap?.has(executionLogicalId(stepId))) {
      console.error(
        "[PostgresAdgGraphRepository] appendDecisionForStep: nodo execution no encontrado",
      );
      return false;
    }

    const client = await this.pool.get().connect();
    const now = new Date();

    try {
      await client.query("BEGIN");

      const decId = crypto.randomUUID();
      const logical = decisionLogicalId(decision.id);
      const outputPayload = {
        category: decision.category,
        chosenId: decision.chosenId,
        justification: decision.justification,
        weights: decision.weights,
        options: decision.options,
        createdAt: decision.createdAt.toISOString(),
      };

      await client.query(
        `INSERT INTO adg_graph_node
           (id, graph_version_id, node_type, status, logical_id, input, output, metadata, created_at)
         VALUES ($1, $2, 'decision', 'completed', $3, '{}'::jsonb, $4::jsonb, $5::jsonb, $6)`,
        [
          decId,
          graphVersionId,
          logical,
          JSON.stringify(outputPayload),
          JSON.stringify({ stepId, phase: "decision" }),
          now,
        ],
      );

      const execNodeId = idMap.get(executionLogicalId(stepId))!;
      await client.query(
        `INSERT INTO adg_graph_edge (id, graph_version_id, from_node_id, to_node_id, edge_type, created_at)
         VALUES ($1, $2, $3, $4, 'depends_on', $5)`,
        [crypto.randomUUID(), graphVersionId, decId, execNodeId, now],
      );

      await client.query("COMMIT");
      return true;
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[PostgresAdgGraphRepository] appendDecisionForStep failed:", err);
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Inserta en una transacción: graph, versión inicial, nodo goal, nodos por paso,
   * y aristas `depends_on` (del paso dependiente al paso requerido).
   */
  async insertPlanGraph(
    sessionId: string,
    plan: Plan,
  ): Promise<PersistedPlanGraph | null> {
    const client = await this.pool.get().connect();
    try {
      await client.query("BEGIN");

      const graphId = crypto.randomUUID();
      const graphVersionId = crypto.randomUUID();
      const now = new Date();

      await client.query(
        `INSERT INTO adg_graph (id, session_id, plan_id, goal, status, created_at, updated_at)
         VALUES ($1, $2, $3, $4, 'active', $5, $6)`,
        [graphId, sessionId, plan.id, plan.goal, now, now],
      );

      await client.query(
        `INSERT INTO adg_graph_version (id, graph_id, version_number, parent_version_id, created_at)
         VALUES ($1, $2, 1, NULL, $3)`,
        [graphVersionId, graphId, now],
      );

      const goalNodeId = crypto.randomUUID();
      await client.query(
        `INSERT INTO adg_graph_node
           (id, graph_version_id, node_type, status, logical_id, input, output, metadata, created_at)
         VALUES ($1, $2, 'goal', 'pending', $3, $4::jsonb, NULL, $5::jsonb, $6)`,
        [
          goalNodeId,
          graphVersionId,
          GOAL_LOGICAL_ID,
          JSON.stringify({ text: plan.goal }),
          JSON.stringify({ actor: "llm", planId: plan.id }),
          now,
        ],
      );

      const logicalToDbId = new Map<string, string>();
      logicalToDbId.set(GOAL_LOGICAL_ID, goalNodeId);

      for (const step of plan.steps) {
        const nodeId = crypto.randomUUID();
        logicalToDbId.set(step.id, nodeId);
        await client.query(
          `INSERT INTO adg_graph_node
             (id, graph_version_id, node_type, status, logical_id, input, output, metadata, created_at)
           VALUES ($1, $2, 'plan_step', $3, $4, $5::jsonb, NULL, $6::jsonb, $7)`,
          [
            nodeId,
            graphVersionId,
            toGraphNodeStatus(step.status),
            step.id,
            JSON.stringify({
              args: step.args,
              stepType: step.type,
              description: step.description,
              approvalRequired: step.approvalRequired,
            }),
            JSON.stringify({ stepType: step.type, description: step.description }),
            now,
          ],
        );
      }

      for (const step of plan.steps) {
        const fromId = logicalToDbId.get(step.id);
        if (!fromId) continue;
        for (const depLogicalId of step.dependsOn) {
          const toId = logicalToDbId.get(depLogicalId);
          if (!toId) continue;
          const edgeId = crypto.randomUUID();
          await client.query(
            `INSERT INTO adg_graph_edge
               (id, graph_version_id, from_node_id, to_node_id, edge_type, created_at)
             VALUES ($1, $2, $3, $4, 'depends_on', $5)`,
            [edgeId, graphVersionId, fromId, toId, now],
          );
        }
      }

      await client.query("COMMIT");
      return { graphId, graphVersionId };
    } catch (err) {
      await client.query("ROLLBACK");
      console.error("[PostgresAdgGraphRepository] insertPlanGraph failed:", err);
      return null;
    } finally {
      client.release();
    }
  }

  /**
   * Fase B: orden topológico de `plan_step` según aristas `depends_on` entre pasos.
   * Desempate estable: orden de aparición en `plan.steps`.
   * Devuelve `null` si hay ciclo, datos incoherentes o error.
   */
  async getPlanStepLogicalIdsTopologicalOrder(
    graphVersionId: string,
    plan: Plan,
  ): Promise<string[] | null> {
    const planIds = new Set(plan.steps.map((s) => s.id));
    if (planIds.size !== plan.steps.length) return null;

    try {
      const stepsRes = await this.pool.get().query<{ logical_id: string }>(
        `SELECT logical_id FROM adg_graph_node
         WHERE graph_version_id = $1 AND node_type = 'plan_step'`,
        [graphVersionId],
      );
      const fromDb = new Set(stepsRes.rows.map((r) => r.logical_id));
      if (fromDb.size !== planIds.size) return null;
      for (const id of planIds) {
        if (!fromDb.has(id)) return null;
      }

      const edgesRes = await this.pool.get().query<{
        from_lid: string;
        to_lid: string;
      }>(
        `SELECT n_from.logical_id AS from_lid, n_to.logical_id AS to_lid
         FROM adg_graph_edge e
         JOIN adg_graph_node n_from ON n_from.id = e.from_node_id
         JOIN adg_graph_node n_to ON n_to.id = e.to_node_id
         WHERE e.graph_version_id = $1
           AND e.edge_type = 'depends_on'
           AND n_from.node_type = 'plan_step'
           AND n_to.node_type = 'plan_step'`,
        [graphVersionId],
      );

      const planIndex = new Map(plan.steps.map((s, i) => [s.id, i]));
      const indegree = new Map<string, number>();
      const whenPrereqDone = new Map<string, string[]>();

      for (const id of planIds) {
        indegree.set(id, 0);
      }
      for (const row of edgesRes.rows) {
        const { from_lid: from, to_lid: to } = row;
        if (!planIds.has(from) || !planIds.has(to)) continue;
        indegree.set(from, (indegree.get(from) ?? 0) + 1);
        if (!whenPrereqDone.has(to)) whenPrereqDone.set(to, []);
        whenPrereqDone.get(to)!.push(from);
      }

      const order: string[] = [];
      const remaining = new Set(planIds);

      while (remaining.size > 0) {
        const ready = [...remaining].filter((id) => indegree.get(id) === 0);
        if (ready.length === 0) {
          console.warn(
            "[PostgresAdgGraphRepository] ciclo en depends_on entre plan_step",
          );
          return null;
        }
        ready.sort((a, b) => planIndex.get(a)! - planIndex.get(b)!);
        const u = ready[0];
        remaining.delete(u);
        order.push(u);
        for (const v of whenPrereqDone.get(u) ?? []) {
          indegree.set(v, (indegree.get(v) ?? 0) - 1);
        }
      }

      return order;
    } catch (err) {
      console.error(
        "[PostgresAdgGraphRepository] getPlanStepLogicalIdsTopologicalOrder failed:",
        err,
      );
      return null;
    }
  }
}
