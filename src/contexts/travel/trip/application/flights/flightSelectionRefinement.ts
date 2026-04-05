import type { DecisionEngine } from "../decide/DecisionEngine";
import type { DecisionRecord } from "../../domain/DecisionRecord";
import type { ResolvedUserTravelPreferences } from "../../domain/UserTravelPreferences";
import type {
  PendingSelectionItem,
  SelectionOptionFlightDetail,
} from "../../domain/GraphExecutionCheckpoint";
import { curateFlightOptions, type CuratableFlightOffer } from "./FlightOptionCurator";
import type { FlightRefinementFilters } from "./flightRefinementTypes";
import { parseFlightToolRows } from "./parseFlightToolRows";
import { rationaleForFlightTags } from "./flightSelectionRationale";

export function flightDetailForParsedRow(
  row: CuratableFlightOffer,
): SelectionOptionFlightDetail {
  return {
    airline: row.airline,
    departureTime: row.departureTime,
    arrivalTime: row.arrivalTime,
    stops: row.stops,
    durationMinutes: row.durationMinutes,
  };
}

/** Re-rankea vuelos desde datos crudos del tool (misma lógica que `GraphExecutor.rankIfSearch`). */
export function rankFlightsFromRawToolData(params: {
  rawData: unknown;
  sessionId: string;
  preferences: ResolvedUserTravelPreferences;
  decisionEngine: DecisionEngine;
  filters?: FlightRefinementFilters;
  preserveDecisionId?: string;
}): { decision: DecisionRecord; flightTotalEligible: number } | null {
  const rows = parseFlightToolRows(params.rawData);
  if (rows.length === 0) return null;
  const curated = curateFlightOptions(rows, params.filters);
  if (curated.shortlist.length === 0) return null;

  const options = curated.shortlist.map((f) => {
    const tags = curated.tagsByFlightId.get(f.id) ?? [];
    return {
      id: f.id,
      label:
        f.displayLabel ??
        `${f.airline} (${f.departureTime}→${f.arrivalTime}) $${f.price}`,
      price: f.price,
      comfortProxy: curated.comfortById.get(f.id) ?? 0,
      ...(tags.length > 0 ? { tags } : {}),
      rationale: rationaleForFlightTags(tags),
    };
  });

  const decision = params.decisionEngine.rank(
    params.sessionId,
    "flight",
    options,
    params.preferences,
  );

  if (params.preserveDecisionId) {
    return {
      decision: {
        ...decision,
        id: params.preserveDecisionId,
        userChosenId: undefined,
      },
      flightTotalEligible: curated.totalEligible,
    };
  }
  return { decision, flightTotalEligible: curated.totalEligible };
}

export function buildFlightPendingSelectionPayload(params: {
  stepId: string;
  decision: DecisionRecord;
  execResultData: unknown;
  flightTotalEligible?: number;
}): PendingSelectionItem {
  return {
    stepId: params.stepId,
    decisionId: params.decision.id,
    selectionRequestLogicalId: `selection_request:${params.decision.id}`,
    selectionKind: "flight",
    title: "Elige tu vuelo",
    ...(params.flightTotalEligible !== undefined
      ? { totalFound: params.flightTotalEligible }
      : {}),
    options: params.decision.options.map((o) => {
      const base = {
        id: o.id,
        label: o.label,
        priceUsd: o.price,
        ...(o.rationale !== undefined ? { rationale: o.rationale } : {}),
        ...(o.tags && o.tags.length > 0 ? { tags: o.tags } : {}),
      };
      if (Array.isArray(params.execResultData)) {
        const row = parseFlightToolRows(params.execResultData).find(
          (r) => r.id === o.id,
        );
        if (row) return { ...base, detail: flightDetailForParsedRow(row) };
      }
      return base;
    }),
  };
}
