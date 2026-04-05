import type { FlightSearchBlockInfo } from "./ATOResponse";
import type { PlannerMissingSlot } from "./PlannerResult";

export type FlightRecoveryContext = {
  userMessage: string;
  planGoal: string;
  flightBlock: FlightSearchBlockInfo;
  searchFlightArgs: Record<string, unknown>;
};

/**
 * Tras un bloqueo de vuelo, produce mensaje + slots para volver a fase {@link ATOResponse.phase} awaiting_input.
 */
export abstract class FlightRecoveryPort {
  abstract requestNeedInputAfterFlightFailure(
    ctx: FlightRecoveryContext,
  ): Promise<{ assistantMessage: string; missingSlots: PlannerMissingSlot[] }>;
}
