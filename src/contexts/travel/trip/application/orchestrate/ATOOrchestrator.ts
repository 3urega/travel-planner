import crypto from "crypto";

import { Service } from "diod";

import { PlannerService } from "../plan/PlannerService";
import { SimulationService } from "../simulate/SimulationService";
import { AuditLogger } from "../audit/AuditLogger";
import { DecisionGraphWriter } from "../graph/DecisionGraphWriter";
import { GraphExecutor } from "../graph/GraphExecutor";
import { PostgresSessionRepository } from "../../infrastructure/postgres/PostgresSessionRepository";
import type { Plan } from "../../domain/Plan";
import type { Session } from "../../domain/Session";
import type { ATOResponse, PendingApprovalItem } from "../../domain/ATOResponse";
import type { DecisionRecord } from "../../domain/DecisionRecord";
import type { UserTravelPreferences } from "../../domain/UserTravelPreferences";
import { mergeUserTravelPreferences } from "../../domain/UserTravelPreferences";

/**
 * Orquestador central del ATO.
 *
 * Pipeline completo:
 *   Goal → Plan (LLM + validación) → Simulation → GraphExecutor (pasos en orden ADG)
 *   → Audit → ATOResponse
 */
@Service()
export class ATOOrchestrator {
  constructor(
    private readonly plannerService: PlannerService,
    private readonly simulationService: SimulationService,
    private readonly auditLogger: AuditLogger,
    private readonly sessionRepository: PostgresSessionRepository,
    private readonly decisionGraphWriter: DecisionGraphWriter,
    private readonly graphExecutor: GraphExecutor,
  ) {}

  async run(
    userMessage: string,
    sessionId?: string,
    incomingPreferences?: UserTravelPreferences,
  ): Promise<ATOResponse> {
    const sid = sessionId ?? crypto.randomUUID();

    const existing = await this.sessionRepository.findById(sid);
    const resolvedPrefs = mergeUserTravelPreferences(
      existing?.preferences,
      incomingPreferences,
    );

    const session: Session = {
      id: sid,
      goal: userMessage,
      status: "active",
      planId: null,
      preferences: {
        ...(resolvedPrefs.maxPriceUsd !== undefined && {
          maxPriceUsd: resolvedPrefs.maxPriceUsd,
        }),
        priceWeight: resolvedPrefs.weights.price,
        comfortWeight: resolvedPrefs.weights.comfort,
      },
      createdAt: existing?.createdAt ?? new Date(),
      updatedAt: new Date(),
    };
    await this.sessionRepository.save(session);
    if (!existing) {
      await this.auditLogger.log({
        sessionId: sid,
        type: "session_created",
        actor: "user",
        reason: userMessage,
      });
    }

    // 2. Generar plan (LLM propone → sistema valida con Zod)
    const plan = await this.plannerService.generate(userMessage, sid, resolvedPrefs);
    await this.auditLogger.log({
      sessionId: sid,
      planId: plan.id,
      type: "plan_generated",
      actor: "llm",
      payloadSnapshot: { stepCount: plan.steps.length, goal: plan.goal },
    });

    const adgPersisted = await this.decisionGraphWriter.persistPlanGraph(
      sid,
      plan,
    );
    if (!adgPersisted) {
      console.warn(
        "[ATOOrchestrator] ADG: persistencia del grafo omitida o fallida (flujo continúa).",
      );
    }

    const graphVersionId = adgPersisted?.graphVersionId;

    // 3. Simulación (sin ejecutar nada)
    const simulation = this.simulationService.simulate(plan);
    if (graphVersionId) {
      await this.decisionGraphWriter.persistSimulationPhase(
        graphVersionId,
        plan,
        simulation,
      );
    }
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

    // 4. Ejecutar pasos (GraphExecutor: orden según dependencias en ADG)
    const { pendingApprovals, executedSteps, decisions } =
      await this.graphExecutor.runPlanStepExecutionPhase({
        graphVersionId,
        plan,
        sessionId: sid,
        preferences: resolvedPrefs,
      });

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
      ...(adgPersisted && {
        adgGraphId: adgPersisted.graphId,
        adgGraphVersionId: adgPersisted.graphVersionId,
      }),
    };
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
