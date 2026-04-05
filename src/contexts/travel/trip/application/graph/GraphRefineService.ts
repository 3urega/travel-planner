import { Service } from "diod";

import { AuditLogger } from "../audit/AuditLogger";
import { DecisionEngine } from "../decide/DecisionEngine";
import { PostgresSessionRepository } from "../../infrastructure/postgres/PostgresSessionRepository";
import { PostgresAdgGraphRepository } from "../../infrastructure/postgres/PostgresAdgGraphRepository";
import {
  GRAPH_CHECKPOINT_PREF_KEY,
  checkpointToPreferenceJson,
  readCheckpointFromPreferences,
} from "../../domain/GraphExecutionCheckpoint";
import { mergeUserTravelPreferences } from "../../domain/UserTravelPreferences";
import type { DecisionRecord } from "../../domain/DecisionRecord";
import type { FlightRefinementFilters } from "../flights/flightRefinementTypes";
import {
  buildFlightPendingSelectionPayload,
  rankFlightsFromRawToolData,
} from "../flights/flightSelectionRefinement";

export type GraphRefineResult =
  | {
      ok: true;
      pendingSelection: ReturnType<typeof buildFlightPendingSelectionPayload>;
      decisions: DecisionRecord[];
    }
  | { ok: false; error: string };

/**
 * Re-cura la shortlist de vuelos desde el resultado cacheado del paso `search_flights` (sin nuevo tool call).
 */
@Service()
export class GraphRefineService {
  constructor(
    private readonly sessionRepository: PostgresSessionRepository,
    private readonly adgRepository: PostgresAdgGraphRepository,
    private readonly decisionEngine: DecisionEngine,
    private readonly auditLogger: AuditLogger,
  ) {}

  async refineFlightSelection(params: {
    sessionId: string;
    graphVersionId: string;
    selectionRequestLogicalId: string;
    filters: FlightRefinementFilters;
  }): Promise<GraphRefineResult> {
    const session = await this.sessionRepository.findById(params.sessionId);
    if (!session) {
      return { ok: false, error: "Sesión no encontrada." };
    }
    if (session.status !== "awaiting_selection") {
      return {
        ok: false,
        error: "La sesión no está esperando selección de catálogo.",
      };
    }

    const prefs = session.preferences as Record<string, unknown>;
    const cp = readCheckpointFromPreferences(prefs);
    if (!cp?.awaitingSelection) {
      return { ok: false, error: "No hay selection_request pendiente." };
    }
    if (cp.awaitingSelection.selectionRequestLogicalId !== params.selectionRequestLogicalId) {
      return { ok: false, error: "selectionRequestLogicalId no coincide." };
    }
    if (cp.graphVersionId !== params.graphVersionId) {
      return { ok: false, error: "graphVersionId no coincide con el checkpoint." };
    }
    if (cp.awaitingSelection.selectionKind !== "flight") {
      return { ok: false, error: "El refinamiento solo aplica a vuelos." };
    }

    const stepId = cp.awaitingSelection.stepId;
    const decisionId = cp.awaitingSelection.decisionId;
    const raw = cp.partialExecutedSteps.find((e) => e.stepId === stepId)?.result;
    if (raw === undefined || !Array.isArray(raw)) {
      return { ok: false, error: "No hay resultados de vuelo en el checkpoint." };
    }

    const resolvedPrefs = mergeUserTravelPreferences(prefs, undefined);
    const ranked = rankFlightsFromRawToolData({
      rawData: raw,
      sessionId: params.sessionId,
      preferences: resolvedPrefs,
      decisionEngine: this.decisionEngine,
      filters: params.filters,
      preserveDecisionId: decisionId,
    });
    if (!ranked) {
      return {
        ok: false,
        error: "Ningún vuelo cumple esos filtros. Relájalos e inténtalo de nuevo.",
      };
    }

    const prevDecisions = cp.partialDecisions.map((d) =>
      d.id === decisionId ? ranked.decision : d,
    );

    const pendingSelection = buildFlightPendingSelectionPayload({
      stepId,
      decision: ranked.decision,
      execResultData: raw,
      flightTotalEligible: ranked.flightTotalEligible,
    });

    const adgOptions = ranked.decision.options.map((o) => ({
      id: o.id,
      label: o.label,
      priceUsd: o.price,
    }));
    await this.adgRepository.updateSelectionRequestFlightOptions(
      params.graphVersionId,
      params.selectionRequestLogicalId,
      adgOptions,
    );

    const updatedCheckpoint = {
      graphVersionId: cp.graphVersionId,
      graphId: cp.graphId,
      fullyCompletedStepIds: cp.fullyCompletedStepIds,
      partialDecisions: prevDecisions,
      partialExecutedSteps: cp.partialExecutedSteps,
      partialPendingApprovals: cp.partialPendingApprovals,
      awaitingSelection: pendingSelection,
    };

    await this.sessionRepository.save({
      ...session,
      preferences: {
        ...prefs,
        [GRAPH_CHECKPOINT_PREF_KEY]: checkpointToPreferenceJson(updatedCheckpoint),
      },
      updatedAt: new Date(),
    });

    await this.auditLogger.log({
      sessionId: params.sessionId,
      type: "decision_made",
      actor: "system",
      payloadSnapshot: {
        kind: "flight_selection_refined",
        selectionRequestLogicalId: params.selectionRequestLogicalId,
        filters: params.filters,
      },
    });

    return {
      ok: true,
      pendingSelection,
      decisions: prevDecisions,
    };
  }
}
