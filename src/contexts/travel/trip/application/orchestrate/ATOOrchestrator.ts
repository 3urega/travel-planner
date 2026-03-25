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
  createAwaitingSelectionSimulationStub,
  createPlaceholderAwaitingPlan,
} from "../../domain/ATOResponse";
import type { DecisionRecord } from "../../domain/DecisionRecord";
import type { UserTravelPreferences } from "../../domain/UserTravelPreferences";
import type { ResolvedUserTravelPreferences } from "../../domain/UserTravelPreferences";
import {
  mergeUserTravelPreferences,
  readGatheredSlots,
} from "../../domain/UserTravelPreferences";
import {
  ADG_GRAPH_ID_PREF_KEY,
  CHECKPOINT_PLAN_PREF_KEY,
  GRAPH_CHECKPOINT_PREF_KEY,
  checkpointToPreferenceJson,
  planFromPreferenceJson,
  planToPreferenceJson,
  readCheckpointFromPreferences,
} from "../../domain/GraphExecutionCheckpoint";

/**
 * Orquestador central del ATO (agente de viajes).
 *
 * **Pipeline cuando el planner devuelve un plan completo:**
 * 1. Sesión persistida (Postgres) con preferencias y slots recogidos.
 * 2. **Planner (LLM):** JSON `plan` con pasos tipados o `need_input` si faltan datos.
 * 3. **ADG:** versión del grafo de decisión asociada a la sesión (audit / trazabilidad).
 * 4. **Simulación:** coste estimado, factibilidad, conflictos de dependencias (sin side effects reales).
 * 5. **GraphExecutor:** ejecuta pasos en orden; scoring; `selection_request` interactivo (`runUntilWait`).
 * 6. Respuesta `ATOResponse` con fase `ready` o `awaiting_selection`, resumen y (opcional) ids ADG.
 *
 * **Bifurcación `need_input`:** no hay plan ejecutable aún; la API devuelve `phase: awaiting_input`.
 *
 * **Reanudación:** tras `POST /api/graph/select`, enviar `{ sessionId, resumeExecution: true }` al agente.
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
   * @param options.resumeExecution - Continúa `GraphExecutor` desde preferences tras una selección HITL.
   */
  async run(
    userMessage: string,
    sessionId?: string,
    incomingPreferences?: UserTravelPreferences,
    incomingSlotValues?: Record<string, string>,
    options?: { resumeExecution?: boolean },
  ): Promise<ATOResponse> {
    const sid = sessionId ?? crypto.randomUUID();

    const existing = await this.sessionRepository.findById(sid);
    const resolvedPrefs = mergeUserTravelPreferences(
      existing?.preferences,
      incomingPreferences,
    );

    const mergedSlots: Record<string, string> = {
      ...readGatheredSlots(existing?.preferences),
      ...(incomingSlotValues ?? {}),
    };

    const mergedPrefs = this.buildMergedPreferences(
      existing?.preferences,
      mergedSlots,
      resolvedPrefs,
    );

    const narrativeForPlanner =
      userMessage.trim() !== ""
        ? userMessage.trim()
        : existing?.goal?.trim() !== ""
          ? existing!.goal
          : "Travel request";

    const goalForSession =
      userMessage.trim() !== "" ? userMessage.trim() : existing?.goal ?? userMessage.trim();

    if (options?.resumeExecution && existing?.status === "awaiting_selection") {
      return this.runResumeFromSelection(
        sid,
        existing,
        goalForSession || narrativeForPlanner,
        mergedPrefs,
        resolvedPrefs,
      );
    }

    const session: Session = {
      id: sid,
      goal: goalForSession || narrativeForPlanner,
      status: "active",
      planId: null,
      preferences: mergedPrefs,
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

    const plannerResult = await this.plannerService.generate(
      narrativeForPlanner,
      sid,
      resolvedPrefs,
      mergedSlots,
    );

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

    const execResult = await this.graphExecutor.runPlanStepExecutionPhase({
      graphVersionId,
      plan,
      sessionId: sid,
      preferences: resolvedPrefs,
      checkpoint: null,
    });

    if (execResult.executionPhase === "awaiting_selection") {
      if (execResult.checkpoint && adgPersisted) {
        execResult.checkpoint.graphId = adgPersisted.graphId;
      }
      mergedPrefs[CHECKPOINT_PLAN_PREF_KEY] = planToPreferenceJson(plan);
      mergedPrefs[GRAPH_CHECKPOINT_PREF_KEY] = checkpointToPreferenceJson(
        execResult.checkpoint!,
      );
      if (adgPersisted) {
        mergedPrefs[ADG_GRAPH_ID_PREF_KEY] = adgPersisted.graphId;
      }

      await this.sessionRepository.save({
        ...session,
        status: "awaiting_selection",
        planId: plan.id,
        preferences: mergedPrefs,
        updatedAt: new Date(),
      });

      const auditEvents = await this.auditLogger.getSessionHistory(sid);
      return {
        sessionId: sid,
        phase: "awaiting_selection",
        pendingSelections: execResult.pendingSelections,
        plan,
        simulation,
        decisions: execResult.decisions,
        pendingApprovals: execResult.pendingApprovals,
        executedSteps: execResult.executedSteps,
        auditEvents,
        summary:
          "Elige una opción del catálogo; confirma con POST /api/graph/select y reanuda con resumeExecution.",
        ...(adgPersisted && {
          adgGraphId: adgPersisted.graphId,
          adgGraphVersionId: adgPersisted.graphVersionId,
        }),
      };
    }

    const finalStatus =
      execResult.pendingApprovals.length > 0 ? "awaiting_approval" : "completed";
    await this.sessionRepository.save({
      ...session,
      status: finalStatus,
      planId: plan.id,
      preferences: this.stripGraphCheckpointPrefs(mergedPrefs),
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
      execResult.pendingApprovals,
      execResult.executedSteps,
      execResult.decisions,
    );

    return {
      sessionId: sid,
      phase: "ready",
      plan,
      simulation,
      decisions: execResult.decisions,
      pendingApprovals: execResult.pendingApprovals,
      executedSteps: execResult.executedSteps,
      auditEvents,
      summary,
      ...(adgPersisted && {
        adgGraphId: adgPersisted.graphId,
        adgGraphVersionId: adgPersisted.graphVersionId,
      }),
    };
  }

  private buildMergedPreferences(
    existingPrefs: Record<string, unknown> | undefined,
    mergedSlots: Record<string, string>,
    resolvedPrefs: ResolvedUserTravelPreferences,
  ): Record<string, unknown> {
    const merged: Record<string, unknown> = { ...(existingPrefs ?? {}) };
    merged.gatheredSlots = mergedSlots;
    merged.priceWeight = resolvedPrefs.weights.price;
    merged.comfortWeight = resolvedPrefs.weights.comfort;
    if (resolvedPrefs.maxPriceUsd !== undefined) {
      merged.maxPriceUsd = resolvedPrefs.maxPriceUsd;
    }
    return merged;
  }

  private stripGraphCheckpointPrefs(
    prefs: Record<string, unknown>,
  ): Record<string, unknown> {
    const next = { ...prefs };
    delete next[CHECKPOINT_PLAN_PREF_KEY];
    delete next[GRAPH_CHECKPOINT_PREF_KEY];
    delete next[ADG_GRAPH_ID_PREF_KEY];
    return next;
  }

  private async runResumeFromSelection(
    sid: string,
    existing: Session,
    goal: string,
    mergedPrefs: Record<string, unknown>,
    resolvedPrefs: ResolvedUserTravelPreferences,
  ): Promise<ATOResponse> {
    const planRaw = mergedPrefs[CHECKPOINT_PLAN_PREF_KEY];
    const plan = planFromPreferenceJson(planRaw);
    const checkpoint = readCheckpointFromPreferences(mergedPrefs);
    if (!plan || !checkpoint) {
      throw new Error("No hay plan o checkpoint de grafo para reanudar.");
    }

    const graphVersionId = checkpoint.graphVersionId;
    const adgGraphId =
      (typeof mergedPrefs[ADG_GRAPH_ID_PREF_KEY] === "string"
        ? mergedPrefs[ADG_GRAPH_ID_PREF_KEY]
        : undefined) ?? checkpoint.graphId;

    const simulation = this.simulationService.simulate(plan);

    const execResult = await this.graphExecutor.runPlanStepExecutionPhase({
      graphVersionId,
      plan,
      sessionId: sid,
      preferences: resolvedPrefs,
      checkpoint,
    });

    if (execResult.executionPhase === "awaiting_selection") {
      mergedPrefs[GRAPH_CHECKPOINT_PREF_KEY] = checkpointToPreferenceJson(
        execResult.checkpoint!,
      );
      mergedPrefs[CHECKPOINT_PLAN_PREF_KEY] = planToPreferenceJson(plan);
      if (adgGraphId) mergedPrefs[ADG_GRAPH_ID_PREF_KEY] = adgGraphId;

      await this.sessionRepository.save({
        ...existing,
        goal,
        preferences: mergedPrefs,
        status: "awaiting_selection",
        updatedAt: new Date(),
      });

      const auditEvents = await this.auditLogger.getSessionHistory(sid);
      return {
        sessionId: sid,
        phase: "awaiting_selection",
        pendingSelections: execResult.pendingSelections,
        plan,
        simulation: createAwaitingSelectionSimulationStub(),
        decisions: execResult.decisions,
        pendingApprovals: execResult.pendingApprovals,
        executedSteps: execResult.executedSteps,
        auditEvents,
        summary:
          "Selecciona otra opción o reanuda tras confirmar en /api/graph/select.",
        ...(adgGraphId && graphVersionId
          ? { adgGraphId: String(adgGraphId), adgGraphVersionId: graphVersionId }
          : {}),
      };
    }

    const finalStatus =
      execResult.pendingApprovals.length > 0 ? "awaiting_approval" : "completed";

    const cleanedPrefs = this.stripGraphCheckpointPrefs(mergedPrefs);

    await this.sessionRepository.save({
      ...existing,
      goal,
      preferences: cleanedPrefs,
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
      execResult.pendingApprovals,
      execResult.executedSteps,
      execResult.decisions,
    );

    return {
      sessionId: sid,
      phase: "ready",
      plan,
      simulation,
      decisions: execResult.decisions,
      pendingApprovals: execResult.pendingApprovals,
      executedSteps: execResult.executedSteps,
      auditEvents,
      summary,
      ...(adgGraphId && graphVersionId
        ? { adgGraphId: String(adgGraphId), adgGraphVersionId: graphVersionId }
        : {}),
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
