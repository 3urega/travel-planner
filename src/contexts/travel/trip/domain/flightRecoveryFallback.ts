import type { FlightRecoveryContext } from "./FlightRecoveryPort";
import type { PlannerMissingSlot } from "./PlannerResult";

/**
 * Recuperación usable sin LLM (parse fallido o adapter degradado).
 */
export function buildDeterministicFlightRecoveryNeedInput(
  ctx: FlightRecoveryContext,
): { assistantMessage: string; missingSlots: PlannerMissingSlot[] } {
  const codeLabel =
    ctx.flightBlock.code === "flight_tool_failed"
      ? "la búsqueda de vuelos falló"
      : "no hubo vuelos elegibles";

  const assistantMessage = `No pudimos seguir con el itinerario porque ${codeLabel}. Detalle: ${ctx.flightBlock.reason}

Por favor indica de nuevo **origen** y **destino** (ciudad o código IATA, ej. BCN, HAM). Si las fechas podrían ser el problema, corrígelas también.`;

  const missingSlots: PlannerMissingSlot[] = [
    {
      id: "recovery_origin",
      role: "origin",
      label: "Origen (ciudad o IATA)",
    },
    {
      id: "recovery_destination",
      role: "destination",
      label: "Destino (ciudad o IATA)",
    },
  ];

  if (ctx.flightBlock.code === "no_flight_offers") {
    missingSlots.push(
      {
        id: "recovery_outbound",
        role: "outbound_date",
        label: "Fecha ida (YYYY-MM-DD)",
      },
      {
        id: "recovery_return",
        role: "return_date",
        label: "Fecha vuelta (YYYY-MM-DD)",
      },
    );
  }

  return { assistantMessage: assistantMessage.trim(), missingSlots };
}
