import { Service } from "diod";

import { PostgresAdgGraphRepository } from "../../infrastructure/postgres/PostgresAdgGraphRepository";
import type { ApprovalPolicyResult } from "../../domain/ApprovalPolicy";
import type { DecisionRecord } from "../../domain/DecisionRecord";
import type { Plan } from "../../domain/Plan";
import type { PersistedPlanGraph } from "../../domain/DecisionGraph";
import type { SimulationResult } from "../../domain/SimulationResult";

/**
 * Construye el ADG a partir del plan y de las fases del orquestador (productor temporal).
 * Fallos de persistencia no interrumpen el pipeline ATO.
 */
@Service()
export class DecisionGraphWriter {
  constructor(private readonly adgRepository: PostgresAdgGraphRepository) {}

  async persistPlanGraph(
    sessionId: string,
    plan: Plan,
  ): Promise<PersistedPlanGraph | null> {
    return this.adgRepository.insertPlanGraph(sessionId, plan);
  }

  /** Fase A: tras `SimulationService.simulate`. */
  async persistSimulationPhase(
    graphVersionId: string,
    plan: Plan,
    simulation: SimulationResult,
  ): Promise<void> {
    const ok = await this.adgRepository.appendSimulationRun(
      graphVersionId,
      plan,
      simulation,
    );
    if (!ok) {
      console.warn("[DecisionGraphWriter] persistSimulationPhase omitido o fallido.");
    }
  }

  /** Fase A: tras evaluar política de aprobación para un paso. */
  async persistApprovalForStep(
    graphVersionId: string,
    stepId: string,
    policy: ApprovalPolicyResult,
    estimatedCost: number | undefined,
  ): Promise<void> {
    const ok = await this.adgRepository.appendApprovalForStep(
      graphVersionId,
      stepId,
      policy.level,
      policy.reason,
      estimatedCost,
    );
    if (!ok) {
      console.warn(
        `[DecisionGraphWriter] persistApprovalForStep omitido (${stepId}).`,
      );
    }
  }

  /** Fase A: tras ejecutar tool con resiliencia. */
  async persistExecutionForStep(
    graphVersionId: string,
    stepId: string,
    toolType: string,
    args: Record<string, unknown>,
    success: boolean,
    resultData: unknown,
    errorMessage: string | undefined,
  ): Promise<void> {
    const ok = await this.adgRepository.appendExecutionForStep(
      graphVersionId,
      stepId,
      toolType,
      args,
      success,
      resultData,
      errorMessage,
    );
    if (!ok) {
      console.warn(
        `[DecisionGraphWriter] persistExecutionForStep omitido (${stepId}).`,
      );
    }
  }

  /** Fase A: tras `DecisionEngine.rank` en búsquedas. */
  async persistDecisionForStep(
    graphVersionId: string,
    stepId: string,
    decision: DecisionRecord,
  ): Promise<void> {
    const ok = await this.adgRepository.appendDecisionForStep(
      graphVersionId,
      stepId,
      decision,
    );
    if (!ok) {
      console.warn(
        `[DecisionGraphWriter] persistDecisionForStep omitido (${stepId}).`,
      );
    }
  }

  /** Tras ranking: nodo HITL `selection_request` en el ADG. */
  async persistSelectionRequestAfterDecision(
    graphVersionId: string,
    stepId: string,
    decision: DecisionRecord,
    title: string,
  ): Promise<void> {
    const ok = await this.adgRepository.appendSelectionRequestForDecision(
      graphVersionId,
      stepId,
      decision,
      title,
    );
    if (!ok) {
      console.warn(
        `[DecisionGraphWriter] persistSelectionRequestAfterDecision omitido (${stepId}).`,
      );
    }
  }
}
