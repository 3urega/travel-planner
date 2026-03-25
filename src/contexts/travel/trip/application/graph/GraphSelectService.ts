import { Service } from "diod";

import { AuditLogger } from "../audit/AuditLogger";
import { PostgresAdgGraphRepository } from "../../infrastructure/postgres/PostgresAdgGraphRepository";
import { PostgresSessionRepository } from "../../infrastructure/postgres/PostgresSessionRepository";
import {
  GRAPH_CHECKPOINT_PREF_KEY,
  checkpointToPreferenceJson,
  readCheckpointFromPreferences,
} from "../../domain/GraphExecutionCheckpoint";

export type GraphSelectResult =
  | { ok: true }
  | { ok: false; error: string };

/**
 * Registra `selection_result` en el ADG y actualiza el checkpoint de sesión para reanudar el grafo.
 */
@Service()
export class GraphSelectService {
  constructor(
    private readonly sessionRepository: PostgresSessionRepository,
    private readonly adgRepository: PostgresAdgGraphRepository,
    private readonly auditLogger: AuditLogger,
  ) {}

  async select(params: {
    sessionId: string;
    graphVersionId: string;
    selectionRequestLogicalId: string;
    selectedOptionId: string;
  }): Promise<GraphSelectResult> {
    const session = await this.sessionRepository.findById(params.sessionId);
    if (!session) {
      return { ok: false, error: "Sesión no encontrada." };
    }
    if (session.status !== "awaiting_selection") {
      return {
        ok: false,
        error: "La sesión no está esperando una selección de catálogo.",
      };
    }

    const prefs = session.preferences as Record<string, unknown>;
    const cp = readCheckpointFromPreferences(prefs);
    if (!cp?.awaitingSelection) {
      return { ok: false, error: "No hay selection_request pendiente en la sesión." };
    }
    if (cp.awaitingSelection.selectionRequestLogicalId !== params.selectionRequestLogicalId) {
      return { ok: false, error: "selectionRequestLogicalId no coincide con el estado actual." };
    }
    if (cp.graphVersionId !== params.graphVersionId) {
      return { ok: false, error: "graphVersionId no coincide con el checkpoint." };
    }

    const persisted = await this.adgRepository.appendSelectionResultForRequest(
      params.graphVersionId,
      params.selectionRequestLogicalId,
      params.selectedOptionId.trim(),
      params.sessionId,
    );
    if (!persisted.ok) {
      return { ok: false, error: persisted.error };
    }

    const userOk = await this.adgRepository.appendUserDecision(
      params.graphVersionId,
      cp.awaitingSelection.decisionId,
      params.selectedOptionId.trim(),
      params.sessionId,
    );
    if (!userOk) {
      return {
        ok: false,
        error: "No se pudo registrar la decisión de usuario en el ADG.",
      };
    }

    const stepId = cp.awaitingSelection.stepId;
    const decisionId = cp.awaitingSelection.decisionId;
    const updatedCheckpoint = {
      graphVersionId: cp.graphVersionId,
      graphId: cp.graphId,
      fullyCompletedStepIds: [
        ...new Set([...(cp.fullyCompletedStepIds ?? []), stepId]),
      ],
      partialDecisions: cp.partialDecisions.map((d) =>
        d.id === decisionId
          ? { ...d, userChosenId: params.selectedOptionId.trim() }
          : d,
      ),
      partialExecutedSteps: cp.partialExecutedSteps,
      partialPendingApprovals: cp.partialPendingApprovals,
    };

    const mergedPrefs = {
      ...prefs,
      [GRAPH_CHECKPOINT_PREF_KEY]: checkpointToPreferenceJson(updatedCheckpoint),
    };

    await this.sessionRepository.save({
      ...session,
      preferences: mergedPrefs,
      updatedAt: new Date(),
    });

    await this.auditLogger.log({
      sessionId: params.sessionId,
      type: "decision_made",
      actor: "user",
      planId: session.planId ?? undefined,
      payloadSnapshot: {
        selectionRequestLogicalId: params.selectionRequestLogicalId,
        chosenOptionId: params.selectedOptionId,
        graphVersionId: params.graphVersionId,
        source: "graph_select",
      },
    });

    return { ok: true };
  }
}
