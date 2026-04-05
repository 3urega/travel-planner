import type { FlightSearchBlockInfo } from "./ATOResponse";
import type { PlannerMissingSlot } from "./PlannerResult";

export type FlightRecoveryContext = {
  userMessage: string;
  planGoal: string;
  flightBlock: FlightSearchBlockInfo;
  searchFlightArgs: Record<string, unknown>;
};

/** Estrategia accionable para salir de un bloqueo de vuelo (parche de slots / preferencias). */
export type FlightRecoverySuggestion = {
  kind:
    | "shift_date"
    | "allow_stops"
    | "expand_airports"
    | "relax_budget";
  label: string;
  /** Valores a fusionar en `slotDraft` / `gatheredSlots` (ids conocidos del dominio). */
  patch: Record<string, string>;
};

export type FlightRecoveryNeedInputResult = {
  assistantMessage: string;
  missingSlots: PlannerMissingSlot[];
  suggestions?: FlightRecoverySuggestion[];
};

/**
 * Tras un bloqueo de vuelo, produce mensaje + slots para volver a fase {@link ATOResponse.phase} awaiting_input.
 */
export abstract class FlightRecoveryPort {
  abstract requestNeedInputAfterFlightFailure(
    ctx: FlightRecoveryContext,
  ): Promise<FlightRecoveryNeedInputResult>;
}
