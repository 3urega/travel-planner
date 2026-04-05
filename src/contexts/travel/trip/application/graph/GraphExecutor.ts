import { Service } from "diod";

import { ApprovalPolicyService } from "../approve/ApprovalPolicyService";
import { DecisionEngine } from "../decide/DecisionEngine";
import { AuditLogger } from "../audit/AuditLogger";
import { DecisionGraphWriter } from "./DecisionGraphWriter";
import { PostgresAdgGraphRepository } from "../../infrastructure/postgres/PostgresAdgGraphRepository";
import { executeWithResilience } from "../../infrastructure/tools/ToolExecutor";
import { TravelToolCatalog } from "../../infrastructure/tools/TravelToolCatalog";
import type { Plan, PlanStep } from "../../domain/Plan";
import type {
  FlightSearchBlockInfo,
  PendingApprovalItem,
} from "../../domain/ATOResponse";
import type { DecisionRecord } from "../../domain/DecisionRecord";
import type { ResolvedUserTravelPreferences } from "../../domain/UserTravelPreferences";
import type {
  GraphExecutionCheckpoint,
  PendingSelectionItem,
  SelectionOptionFlightDetail,
} from "../../domain/GraphExecutionCheckpoint";

const INTERACTIVE_SEARCH_TYPES = new Set<string>(["search_flights", "search_hotels"]);

type FlightToolRow = {
  id: string;
  airline: string;
  price: number;
  departureTime: string;
  arrivalTime: string;
  stops: number;
  durationMinutes?: number;
  displayLabel?: string;
};

export type PlanStepExecutionResult = {
  pendingApprovals: PendingApprovalItem[];
  executedSteps: Array<{ stepId: string; result: unknown }>;
  decisions: DecisionRecord[];
  /** `awaiting_selection`: run-until-wait detuvo el motor en un `selection_request`. `blocked`: vuelo fallido o sin ofertas. */
  executionPhase: "completed" | "awaiting_selection" | "blocked";
  pendingSelections?: PendingSelectionItem[];
  checkpoint?: GraphExecutionCheckpoint;
  flightBlock?: FlightSearchBlockInfo;
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
    private readonly travelToolCatalog: TravelToolCatalog,
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
      ...((checkpoint?.partialPendingApprovals ??
        []) as PendingApprovalItem[]),
    ];
    const executedSteps: Array<{ stepId: string; result: unknown }> = [
      ...(checkpoint?.partialExecutedSteps ?? []),
    ];
    const decisions: DecisionRecord[] = [...(checkpoint?.partialDecisions ?? [])];
    const tools = this.travelToolCatalog.getTools();

    for (const step of steps) {
      if (fullyCompleted.has(step.id)) {
        continue;
      }

      const toolDef = tools[step.type];
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

        if (
          process.env.ATO_FLIGHT_DEBUG === "1" &&
          step.type === "search_flights"
        ) {
          console.warn("[ATO][search_flights] step", {
            stepId: step.id,
            type: step.type,
            args: step.args,
          });
        }

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
          let decision: DecisionRecord | null = null;

          if (step.type === "search_flights") {
            decision = await this.rankIfSearch(
              step,
              execResult.data,
              sid,
              preferences,
            );
            if (!decision) {
              const reason =
                !Array.isArray(execResult.data) || execResult.data.length === 0
                  ? "La búsqueda no devolvió vuelos. Revisa origen, destino y fecha."
                  : "Ningún vuelo devuelto fue elegible para el ranking (datos incompletos o precios inválidos).";
              await this.auditLogger.log({
                sessionId: sid,
                planId: plan.id,
                stepId: step.id,
                type: "step_blocked",
                actor: "system",
                reason,
                payloadSnapshot: {
                  code: "no_flight_offers",
                  rawCount: Array.isArray(execResult.data)
                    ? execResult.data.length
                    : 0,
                },
              });
              return {
                pendingApprovals,
                executedSteps,
                decisions,
                executionPhase: "blocked",
                flightBlock: {
                  stepId: step.id,
                  code: "no_flight_offers",
                  reason,
                },
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
          }

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

          if (step.type !== "search_flights") {
            decision = await this.rankIfSearch(
              step,
              execResult.data,
              sid,
              preferences,
            );
          }

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
                options: decision.options.map((o) => {
                  const base = {
                    id: o.id,
                    label: o.label,
                    priceUsd: o.price,
                  };
                  if (step.type === "search_flights" && Array.isArray(execResult.data)) {
                    const detail = this.flightDetailForOption(
                      o.id,
                      execResult.data,
                    );
                    if (detail) return { ...base, detail };
                  }
                  return base;
                }),
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

            if (
              !graphVersionId &&
              INTERACTIVE_SEARCH_TYPES.has(step.type)
            ) {
              console.warn(
                `[GraphExecutor] Paso interactivo ${step.type} sin graphVersionId; ` +
                  "no se puede mostrar selección HITL. Revise persistencia del ADG.",
              );
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

          if (step.type === "search_flights") {
            return {
              pendingApprovals,
              executedSteps,
              decisions,
              executionPhase: "blocked",
              flightBlock: {
                stepId: step.id,
                code: "flight_tool_failed",
                reason: execResult.error,
              },
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
      const rows = this.parseFlightToolRows(data);
      if (rows.length === 0) return null;
      const durs = rows
        .map((r) => r.durationMinutes)
        .filter((d): d is number => d !== undefined && Number.isFinite(d));
      const minDur = durs.length > 0 ? Math.min(...durs) : 0;
      const maxDur = durs.length > 0 ? Math.max(...durs) : 1;
      const durSpan = maxDur - minDur || 1;
      const options = rows.map((f) => ({
        id: f.id,
        label:
          f.displayLabel ??
          `${f.airline} (${f.departureTime}→${f.arrivalTime}) $${f.price}`,
        price: f.price,
        comfortProxy: this.compositeFlightComfort(f, minDur, durSpan),
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

  private parseFlightToolRows(data: unknown): FlightToolRow[] {
    if (!Array.isArray(data)) return [];
    const out: FlightToolRow[] = [];
    for (const item of data) {
      if (typeof item !== "object" || item === null) continue;
      const o = item as Record<string, unknown>;
      const id = typeof o.id === "string" ? o.id : "";
      if (!id) continue;
      const priceRaw = o.priceUsd ?? o.price;
      const price =
        typeof priceRaw === "number" ? priceRaw : Number(priceRaw);
      if (!Number.isFinite(price)) continue;
      const dep =
        typeof o.departureTime === "string"
          ? o.departureTime
          : typeof o.departure === "string"
            ? o.departure
            : "00:00";
      const arr =
        typeof o.arrivalTime === "string"
          ? o.arrivalTime
          : typeof o.arrival === "string"
            ? o.arrival
            : "00:00";
      const stopsRaw = o.stops;
      const stops =
        typeof stopsRaw === "number"
          ? stopsRaw
          : Number.isFinite(Number(stopsRaw))
            ? Number(stopsRaw)
            : 0;
      const dm = o.durationMinutes;
      const durationMinutes =
        dm !== undefined && Number.isFinite(Number(dm))
          ? Number(dm)
          : undefined;
      const displayLabel =
        typeof o.displayLabel === "string" ? o.displayLabel : undefined;
      out.push({
        id,
        airline: typeof o.airline === "string" ? o.airline : "",
        price,
        departureTime: dep,
        arrivalTime: arr,
        stops,
        durationMinutes,
        displayLabel,
      });
    }
    return out;
  }

  private flightDetailForOption(
    optionId: string,
    data: unknown,
  ): SelectionOptionFlightDetail | undefined {
    const row = this.parseFlightToolRows(data).find((r) => r.id === optionId);
    if (!row) return undefined;
    return {
      airline: row.airline,
      departureTime: row.departureTime,
      arrivalTime: row.arrivalTime,
      stops: row.stops,
      durationMinutes: row.durationMinutes,
    };
  }

  private flightComfortProxy(departure: string): number {
    const [h = "0", m = "0"] = departure.split(":");
    const minutes = parseInt(h, 10) * 60 + parseInt(m, 10);
    return Math.max(0, 1 - Math.abs(minutes - 600) / 600);
  }

  private compositeFlightComfort(
    f: FlightToolRow,
    minDur: number,
    durSpan: number,
  ): number {
    const timePref = this.flightComfortProxy(f.departureTime);
    const stopPref = 1 / (1 + f.stops * 0.35);
    let durPref = 0.65;
    if (f.durationMinutes !== undefined && Number.isFinite(f.durationMinutes)) {
      durPref = 1 - (f.durationMinutes - minDur) / durSpan;
      durPref = Math.max(0, Math.min(1, durPref));
    }
    return 0.45 * timePref + 0.35 * stopPref + 0.2 * durPref;
  }
}
