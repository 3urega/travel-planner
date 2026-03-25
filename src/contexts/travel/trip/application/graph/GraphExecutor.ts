import { Service } from "diod";

import { ApprovalPolicyService } from "../approve/ApprovalPolicyService";
import { DecisionEngine } from "../decide/DecisionEngine";
import { AuditLogger } from "../audit/AuditLogger";
import { DecisionGraphWriter } from "./DecisionGraphWriter";
import { PostgresAdgGraphRepository } from "../../infrastructure/postgres/PostgresAdgGraphRepository";
import { travelTools } from "../../infrastructure/tools/MockTravelTools";
import { executeWithResilience } from "../../infrastructure/tools/ToolExecutor";
import type { Plan, PlanStep } from "../../domain/Plan";
import type { PendingApprovalItem } from "../../domain/ATOResponse";
import type { DecisionRecord } from "../../domain/DecisionRecord";
import type { ResolvedUserTravelPreferences } from "../../domain/UserTravelPreferences";
import type {
  GraphExecutionCheckpoint,
  PendingSelectionItem,
} from "../../domain/GraphExecutionCheckpoint";

const INTERACTIVE_SEARCH_TYPES = new Set<string>(["search_flights", "search_hotels"]);

export type PlanStepExecutionResult = {
  pendingApprovals: PendingApprovalItem[];
  executedSteps: Array<{ stepId: string; result: unknown }>;
  decisions: DecisionRecord[];
  /** `awaiting_selection`: run-until-wait detuvo el motor en un `selection_request`. */
  executionPhase: "completed" | "awaiting_selection";
  pendingSelections?: PendingSelectionItem[];
  checkpoint?: GraphExecutionCheckpoint;
};

/**
 * Fase B: motor de ejecución alineado con el ADG.
 * Ordena `plan_step` según dependencias persistidas y ejecuta el mismo pipeline
 * (aprobación → tool → decisión). Modo interactivo: tras ranking en búsquedas,
 * persiste `selection_request` y **para** hasta POST /api/graph/select + resume.
 */
@Service()
export class GraphExecutor {
  constructor(
    private readonly adgRepository: PostgresAdgGraphRepository,
    private readonly approvalPolicyService: ApprovalPolicyService,
    private readonly decisionEngine: DecisionEngine,
    private readonly auditLogger: AuditLogger,
    private readonly decisionGraphWriter: DecisionGraphWriter,
  ) {}

  /**
   * Recorre los pasos en orden topológico del grafo (o el orden del plan si falla la lectura).
   * Con `checkpoint` reanuda tras una selección humana (`fullyCompletedStepIds`).
   */
  async runPlanStepExecutionPhase(params: {
    graphVersionId: string | undefined;
    plan: Plan;
    sessionId: string;
    preferences: ResolvedUserTravelPreferences;
    checkpoint?: GraphExecutionCheckpoint | null;
  }): Promise<PlanStepExecutionResult> {
    const {
      graphVersionId,
      plan,
      sessionId: sid,
      preferences,
      checkpoint,
    } = params;

    const steps = await this.resolveExecutionOrder(graphVersionId, plan);
    const fullyCompleted = new Set(checkpoint?.fullyCompletedStepIds ?? []);

    const pendingApprovals: PendingApprovalItem[] = [
      ...(checkpoint?.partialPendingApprovals as PendingApprovalItem[]),
    ];
    const executedSteps: Array<{ stepId: string; result: unknown }> = [
      ...(checkpoint?.partialExecutedSteps ?? []),
    ];
    const decisions: DecisionRecord[] = [...(checkpoint?.partialDecisions ?? [])];

    for (const step of steps) {
      if (fullyCompleted.has(step.id)) {
        continue;
      }

      const toolDef = travelTools[step.type];
      const estimatedCost = toolDef?.estimateCost?.(step.args);
      const approvalResult = this.approvalPolicyService.evaluate(
        step,
        estimatedCost,
      );

      if (graphVersionId) {
        await this.decisionGraphWriter.persistApprovalForStep(
          graphVersionId,
          step.id,
          approvalResult,
          estimatedCost,
        );
      }

      if (approvalResult.level === "auto" && toolDef) {
        await this.auditLogger.log({
          sessionId: sid,
          planId: plan.id,
          stepId: step.id,
          type: "step_started",
          actor: "system",
        });
        await this.auditLogger.log({
          sessionId: sid,
          planId: plan.id,
          stepId: step.id,
          type: "tool_called",
          actor: "system",
          payloadSnapshot: { tool: step.type, args: step.args },
        });

        const execResult = await executeWithResilience(toolDef, step.args);

        if (graphVersionId) {
          await this.decisionGraphWriter.persistExecutionForStep(
            graphVersionId,
            step.id,
            step.type,
            step.args,
            execResult.success,
            execResult.success ? execResult.data : undefined,
            execResult.success ? undefined : execResult.error,
          );
        }

        if (execResult.success) {
          executedSteps.push({ stepId: step.id, result: execResult.data });
          await this.auditLogger.log({
            sessionId: sid,
            planId: plan.id,
            stepId: step.id,
            type: "tool_succeeded",
            actor: "system",
            payloadSnapshot: { attempts: execResult.attempts },
          });
          await this.auditLogger.log({
            sessionId: sid,
            planId: plan.id,
            stepId: step.id,
            type: "step_completed",
            actor: "system",
          });

          const decision = await this.rankIfSearch(
            step,
            execResult.data,
            sid,
            preferences,
          );
          if (decision) {
            decisions.push(decision);
            if (graphVersionId) {
              await this.decisionGraphWriter.persistDecisionForStep(
                graphVersionId,
                step.id,
                decision,
              );
            }

            if (
              graphVersionId &&
              INTERACTIVE_SEARCH_TYPES.has(step.type)
            ) {
              const title =
                step.type === "search_hotels"
                  ? "Elige tu hotel"
                  : "Elige tu vuelo";
              await this.decisionGraphWriter.persistSelectionRequestAfterDecision(
                graphVersionId,
                step.id,
                decision,
                title,
              );

              const pendingSel: PendingSelectionItem = {
                stepId: step.id,
                decisionId: decision.id,
                selectionRequestLogicalId: `selection_request:${decision.id}`,
                selectionKind:
                  decision.category === "hotel" ? "hotel" : "flight",
                title,
                options: decision.options.map((o) => ({
                  id: o.id,
                  label: o.label,
                  priceUsd: o.price,
                })),
              };

              const execCheckpoint: GraphExecutionCheckpoint = {
                graphVersionId,
                graphId: checkpoint?.graphId,
                fullyCompletedStepIds: [...fullyCompleted],
                partialDecisions: [...decisions],
                partialExecutedSteps: [...executedSteps],
                partialPendingApprovals: [...pendingApprovals],
                awaitingSelection: pendingSel,
              };

              await this.auditLogger.log({
                sessionId: sid,
                planId: plan.id,
                stepId: step.id,
                type: "input_required",
                actor: "system",
                payloadSnapshot: {
                  kind: "selection_request",
                  selectionRequestLogicalId: pendingSel.selectionRequestLogicalId,
                },
              });

              return {
                pendingApprovals,
                executedSteps,
                decisions,
                executionPhase: "awaiting_selection",
                pendingSelections: [pendingSel],
                checkpoint: execCheckpoint,
              };
            }
          }
        } else {
          await this.auditLogger.log({
            sessionId: sid,
            planId: plan.id,
            stepId: step.id,
            type: "tool_failed",
            actor: "system",
            reason: execResult.error,
            payloadSnapshot: { attempts: execResult.attempts },
          });
          await this.auditLogger.log({
            sessionId: sid,
            planId: plan.id,
            stepId: step.id,
            type: "step_failed",
            actor: "system",
            reason: execResult.error,
          });
        }
      } else {
        pendingApprovals.push({
          stepId: step.id,
          stepType: step.type,
          description: step.description,
          level: approvalResult.level,
          reason: approvalResult.reason,
          estimatedCost,
          args: step.args,
        });
        await this.auditLogger.log({
          sessionId: sid,
          planId: plan.id,
          stepId: step.id,
          type: "step_blocked",
          actor: "system",
          reason: approvalResult.reason,
        });
        await this.auditLogger.log({
          sessionId: sid,
          planId: plan.id,
          stepId: step.id,
          type: "approval_requested",
          actor: "system",
          reason: `level:${approvalResult.level} — ${approvalResult.reason}`,
        });
      }
    }

    return {
      pendingApprovals,
      executedSteps,
      decisions,
      executionPhase: "completed",
      checkpoint: graphVersionId
        ? {
            graphVersionId,
            graphId: checkpoint?.graphId,
            fullyCompletedStepIds: [...fullyCompleted],
            partialDecisions: decisions,
            partialExecutedSteps: executedSteps,
            partialPendingApprovals: pendingApprovals,
          }
        : undefined,
    };
  }

  private async resolveExecutionOrder(
    graphVersionId: string | undefined,
    plan: Plan,
  ): Promise<PlanStep[]> {
    if (!graphVersionId) return plan.steps;
    const orderedIds =
      await this.adgRepository.getPlanStepLogicalIdsTopologicalOrder(
        graphVersionId,
        plan,
      );
    if (!orderedIds) return plan.steps;
    const byId = new Map(plan.steps.map((s) => [s.id, s]));
    const steps: PlanStep[] = [];
    for (const id of orderedIds) {
      const s = byId.get(id);
      if (!s) return plan.steps;
      steps.push(s);
    }
    return steps;
  }

  private async rankIfSearch(
    step: PlanStep,
    data: unknown,
    sessionId: string,
    preferences: ResolvedUserTravelPreferences,
  ): Promise<DecisionRecord | null> {
    if (!Array.isArray(data) || data.length === 0) return null;

    if (step.type === "search_flights") {
      type FlightRow = {
        id: string;
        airline: string;
        price: number;
        departure: string;
        arrival: string;
      };
      const options = (data as FlightRow[]).map((f) => ({
        id: f.id,
        label: `${f.airline} (${f.departure}→${f.arrival}) $${f.price}`,
        price: f.price,
        comfortProxy: this.flightComfortProxy(f.departure),
      }));
      const decision = this.decisionEngine.rank(
        sessionId,
        "flight",
        options,
        preferences,
      );
      await this.auditLogger.log({
        sessionId,
        type: "decision_made",
        actor: "system",
        payloadSnapshot: { category: "flight", chosenId: decision.chosenId },
      });
      return decision;
    }

    if (step.type === "search_hotels") {
      type HotelRow = {
        id: string;
        name: string;
        price_per_night: number;
        stars: number;
      };
      const options = (data as HotelRow[]).map((h) => ({
        id: h.id,
        label: `${h.name} (${h.stars}★) $${h.price_per_night}/noche`,
        price: h.price_per_night,
        comfortProxy: h.stars / 5,
      }));
      const decision = this.decisionEngine.rank(
        sessionId,
        "hotel",
        options,
        preferences,
      );
      await this.auditLogger.log({
        sessionId,
        type: "decision_made",
        actor: "system",
        payloadSnapshot: { category: "hotel", chosenId: decision.chosenId },
      });
      return decision;
    }

    return null;
  }

  private flightComfortProxy(departure: string): number {
    const [h = "0", m = "0"] = departure.split(":");
    const minutes = parseInt(h, 10) * 60 + parseInt(m, 10);
    return Math.max(0, 1 - Math.abs(minutes - 600) / 600);
  }
}
