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
import {
  createAwaitingInputSimulationStub,
  createPlaceholderAwaitingPlan,
} from "../../domain/ATOResponse";
import type { DecisionRecord } from "../../domain/DecisionRecord";
import type { UserTravelPreferences } from "../../domain/UserTravelPreferences";
import {
  mergeUserTravelPreferences,
  readGatheredSlots,
} from "../../domain/UserTravelPreferences";

/**
 * Orquestador central del ATO (agente de viajes).
 *
 * **Pipeline cuando el planner devuelve un plan completo:**
 * 1. Sesión persistida (Postgres) con preferencias y slots recogidos.
 * 2. **Planner (LLM):** JSON `plan` con pasos tipados o `need_input` si faltan datos.
 * 3. **ADG:** versión del grafo de decisión asociada a la sesión (audit / trazabilidad).
 * 4. **Simulación:** coste estimado, factibilidad, conflictos de dependencias (sin side effects reales).
 * 5. **GraphExecutor:** ejecuta pasos en orden; scoring precio/confort; aprueba o deja pendientes.
 * 6. Respuesta `ATOResponse` con fase `ready`, resumen y (opcional) ids ADG.
 *
 * **Bifurcación `need_input`:** no hay plan ejecutable aún; la API devuelve `phase: awaiting_input`
 * y la UI debe volver a llamar con el mismo `sessionId` y `slotValues` rellenando lo que pide el LLM.
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

  /**
   * Ejecuta un ciclo completo del agente para una petición HTTP (mensaje nuevo o continuación).
   *
   * @param userMessage - Texto del usuario; puede ir vacío si es continuación solo con slots.
   * @param sessionId - Misma sesión entre turnos; si no viene, se genera UUID nuevo.
   * @param incomingPreferences - Preferencias opcionales (presupuesto, pesos precio/confort).
   * @param incomingSlotValues - Valores para slots que el planner marcó como faltantes (fechas, destino, etc.).
   */
  async run(
    userMessage: string,
    sessionId?: string,
    incomingPreferences?: UserTravelPreferences,
    incomingSlotValues?: Record<string, string>,
  ): Promise<ATOResponse> {
    const sid = sessionId ?? crypto.randomUUID();

    const existing = await this.sessionRepository.findById(sid);
    const resolvedPrefs = mergeUserTravelPreferences(
      existing?.preferences,
      incomingPreferences,
    );

    // Slots ya guardados en sesión + los que mande el cliente en este POST.
    const mergedSlots: Record<string, string> = {
      ...readGatheredSlots(existing?.preferences),
      ...(incomingSlotValues ?? {}),
    };

    // Texto que ve el LLM: mensaje nuevo, o el goal guardado si el usuario solo envía slots.
    const narrativeForPlanner =
      userMessage.trim() !== ""
        ? userMessage.trim()
        : existing?.goal?.trim() !== ""
          ? existing!.goal
          : "Travel request";

    // goal en Session: conserva el último mensaje explícito o el goal previo al fusionar slots.
    const goalForSession =
      userMessage.trim() !== "" ? userMessage.trim() : existing?.goal ?? userMessage.trim();

    const session: Session = {
      id: sid,
      goal: goalForSession || narrativeForPlanner,
      status: "active",
      planId: null,
      preferences: {
        ...(resolvedPrefs.maxPriceUsd !== undefined && {
          maxPriceUsd: resolvedPrefs.maxPriceUsd,
        }),
        priceWeight: resolvedPrefs.weights.price,
        comfortWeight: resolvedPrefs.weights.comfort,
        gatheredSlots: mergedSlots,
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
        reason: narrativeForPlanner,
      });
    }

    // --- Planner: única llamada LLM estructurada; decide need_input vs plan ---
    const plannerResult = await this.plannerService.generate(
      narrativeForPlanner,
      sid,
      resolvedPrefs,
      mergedSlots,
    );

    // Salida temprana: el cliente debe rellenar missingSlots y repetir POST con sessionId.
    if (plannerResult.kind === "need_input") {
      await this.auditLogger.log({
        sessionId: sid,
        type: "input_required",
        actor: "llm",
        payloadSnapshot: {
          missingSlotCount: plannerResult.missingSlots.length,
          slotIds: plannerResult.missingSlots.map((s) => s.id),
        },
      });

      await this.sessionRepository.save({
        ...session,
        status: "active",
        updatedAt: new Date(),
      });

      const auditEvents = await this.auditLogger.getSessionHistory(sid);
      // Plan/simulación ficticios: la UI espera la misma forma que en phase ready.
      const placeholderPlan = createPlaceholderAwaitingPlan(sid);
      const stubSim = createAwaitingInputSimulationStub();

      return {
        sessionId: sid,
        phase: "awaiting_input",
        assistantMessage: plannerResult.assistantMessage,
        missingSlots: plannerResult.missingSlots,
        plan: placeholderPlan,
        simulation: stubSim,
        decisions: [],
        pendingApprovals: [],
        executedSteps: [],
        auditEvents,
        summary: plannerResult.assistantMessage,
      };
    }

    // --- Camino feliz: plan válido → persistir grafo, simular, ejecutar pasos ---
    const plan = plannerResult.plan;

    await this.auditLogger.log({
      sessionId: sid,
      planId: plan.id,
      type: "plan_generated",
      actor: "llm",
      payloadSnapshot: { stepCount: plan.steps.length, goal: plan.goal },
    });

    const adgPersisted = await this.decisionGraphWriter.persistPlanGraph(sid, plan);
    if (!adgPersisted) {
      console.warn(
        "[ATOOrchestrator] ADG: persistencia del grafo omitida o fallida (flujo continúa).",
      );
    }

    const graphVersionId = adgPersisted?.graphVersionId;

    // Simulación en memoria; opcionalmente se vuelca al ADG junto al plan.
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

    // Ejecución ordenada según dependencias del plan; genera decisiones y aprobaciones pendientes.
    const { pendingApprovals, executedSteps, decisions } =
      await this.graphExecutor.runPlanStepExecutionPhase({
        graphVersionId,
        plan,
        sessionId: sid,
        preferences: resolvedPrefs,
      });

    // Si quedan pasos que requieren confirmación humana, la sesión no se marca como completed.
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
      phase: "ready",
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

  /** Texto único para la UI: mezcla resumen del plan, simulación, ejecución y colas de aprobación. */
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
