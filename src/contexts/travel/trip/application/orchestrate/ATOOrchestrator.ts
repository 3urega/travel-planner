import crypto from "crypto";

import { Service } from "diod";

import { PlannerService } from "../plan/PlannerService";
import { SimulationService } from "../simulate/SimulationService";
import { ApprovalPolicyService } from "../approve/ApprovalPolicyService";
import { DecisionEngine } from "../decide/DecisionEngine";
import { AuditLogger } from "../audit/AuditLogger";
import { PostgresSessionRepository } from "../../infrastructure/postgres/PostgresSessionRepository";
import { travelTools } from "../../infrastructure/tools/MockTravelTools";
import { executeWithResilience } from "../../infrastructure/tools/ToolExecutor";
import type { Plan, PlanStep } from "../../domain/Plan";
import type { Session } from "../../domain/Session";
import type { ATOResponse, PendingApprovalItem } from "../../domain/ATOResponse";
import type { DecisionRecord } from "../../domain/DecisionRecord";

/**
 * Orquestador central del ATO.
 *
 * Pipeline completo:
 *   Goal → Plan (LLM + validación) → Simulation → ApprovalPolicy
 *   → Execution (auto) / Pending (confirm/double)
 *   → Decision scoring → Audit → ATOResponse
 */
@Service()
export class ATOOrchestrator {
  constructor(
    private readonly plannerService: PlannerService,
    private readonly simulationService: SimulationService,
    private readonly approvalPolicyService: ApprovalPolicyService,
    private readonly decisionEngine: DecisionEngine,
    private readonly auditLogger: AuditLogger,
    private readonly sessionRepository: PostgresSessionRepository,
  ) {}

  async run(userMessage: string, sessionId?: string): Promise<ATOResponse> {
    const sid = sessionId ?? crypto.randomUUID();

    // 1. Crear sesión
    const session: Session = {
      id: sid,
      goal: userMessage,
      status: "active",
      planId: null,
      preferences: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    await this.sessionRepository.save(session);
    await this.auditLogger.log({
      sessionId: sid,
      type: "session_created",
      actor: "user",
      reason: userMessage,
    });

    // 2. Generar plan (LLM propone → sistema valida con Zod)
    const plan = await this.plannerService.generate(userMessage, sid);
    await this.auditLogger.log({
      sessionId: sid,
      planId: plan.id,
      type: "plan_generated",
      actor: "llm",
      payloadSnapshot: { stepCount: plan.steps.length, goal: plan.goal },
    });

    // 3. Simulación (sin ejecutar nada)
    const simulation = this.simulationService.simulate(plan);
    await this.auditLogger.log({
      sessionId: sid,
      planId: plan.id,
      type: "simulation_run",
      actor: "system",
      payloadSnapshot: {
        totalCost: simulation.totalEstimatedCost,
        feasible: simulation.feasible,
        conflicts: simulation.dependencyConflicts.length,
      },
    });

    // 4. Ejecutar pasos o registrar pendientes según política de aprobación
    const pendingApprovals: PendingApprovalItem[] = [];
    const executedSteps: Array<{ stepId: string; result: unknown }> = [];
    const decisions: DecisionRecord[] = [];

    for (const step of plan.steps) {
      const toolDef = travelTools[step.type];
      const estimatedCost = toolDef?.estimateCost?.(step.args);
      const approvalResult = this.approvalPolicyService.evaluate(
        step,
        estimatedCost,
      );

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

          // Aplicar decision engine sobre resultados de búsquedas
          const decision = await this.rankIfSearch(
            step,
            execResult.data,
            sid,
          );
          if (decision) decisions.push(decision);
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
        // Acción requiere aprobación humana (confirm o double)
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

    // 5. Actualizar estado de sesión
    const finalStatus =
      pendingApprovals.length > 0 ? "awaiting_approval" : "completed";
    await this.sessionRepository.save({
      ...session,
      status: finalStatus,
      planId: plan.id,
      updatedAt: new Date(),
    });
    await this.auditLogger.log({
      sessionId: sid,
      planId: plan.id,
      type: "session_completed",
      actor: "system",
      reason: finalStatus,
    });

    // 6. Recoger trail completo
    const auditEvents = await this.auditLogger.getSessionHistory(sid);

    const summary = this.buildSummary(
      plan,
      simulation,
      pendingApprovals,
      executedSteps,
      decisions,
    );

    return {
      sessionId: sid,
      plan,
      simulation,
      decisions,
      pendingApprovals,
      executedSteps,
      auditEvents,
      summary,
    };
  }

  private async rankIfSearch(
    step: PlanStep,
    data: unknown,
    sessionId: string,
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
      const decision = this.decisionEngine.rank(sessionId, "flight", options);
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
      const decision = this.decisionEngine.rank(sessionId, "hotel", options);
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

  /** Proxy de confort para vuelos: salidas más cómodas (~08:00–12:00). */
  private flightComfortProxy(departure: string): number {
    const [h = "0", m = "0"] = departure.split(":");
    const minutes = parseInt(h, 10) * 60 + parseInt(m, 10);
    // Óptimo a las 10:00 (600 min); penalizar madrugadas y noches tardías
    return Math.max(0, 1 - Math.abs(minutes - 600) / 600);
  }

  private buildSummary(
    plan: Plan,
    simulation: { humanSummary: string },
    pending: PendingApprovalItem[],
    executed: Array<{ stepId: string }>,
    decisions: DecisionRecord[],
  ): string {
    const parts: string[] = [
      `Plan "${plan.goal}" generado con ${plan.steps.length} paso(s).`,
      simulation.humanSummary,
    ];
    if (executed.length > 0) {
      parts.push(`${executed.length} paso(s) ejecutados automáticamente.`);
    }
    if (decisions.length > 0) {
      parts.push(
        `${decisions.length} decisión(es) tomadas por scoring (precio/confort).`,
      );
    }
    if (pending.length > 0) {
      const doubles = pending.filter((p) => p.level === "double").length;
      const confirms = pending.filter((p) => p.level === "confirm").length;
      const parts2: string[] = [];
      if (doubles > 0)
        parts2.push(`${doubles} con doble confirmación requerida`);
      if (confirms > 0) parts2.push(`${confirms} con confirmación simple`);
      parts.push(`${pending.length} acción(es) pendientes (${parts2.join(", ")}).`);
    }
    return parts.join(" ");
  }
}
