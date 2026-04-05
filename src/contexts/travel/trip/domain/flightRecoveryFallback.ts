import type {
  FlightRecoveryContext,
  FlightRecoverySuggestion,
} from "./FlightRecoveryPort";
import type { PlannerMissingSlot } from "./PlannerResult";

function addDaysIso(isoDate: string, deltaDays: number): string | null {
  const d = new Date(`${isoDate.trim()}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return null;
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

/**
 * Hasta 3 sugerencias deterministas a partir de los args de búsqueda fallida.
 */
export function buildDeterministicRecoverySuggestions(
  ctx: FlightRecoveryContext,
): FlightRecoverySuggestion[] {
  const args = ctx.searchFlightArgs;
  const date =
    typeof args.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(args.date)
      ? args.date
      : null;
  const out: FlightRecoverySuggestion[] = [];

  if (date) {
    const prev = addDaysIso(date, -1);
    const next = addDaysIso(date, 1);
    if (prev) {
      out.push({
        kind: "shift_date",
        label: `Probar un día antes (${prev})`,
        patch: { recovery_outbound: prev },
      });
    }
    if (next) {
      out.push({
        kind: "shift_date",
        label: `Probar un día después (${next})`,
        patch: { recovery_outbound: next },
      });
    }
  }

  if (args.non_stop === true) {
    out.push({
      kind: "allow_stops",
      label: "Incluir vuelos con conexión (quitar solo directos)",
      patch: { recovery_allow_connections: "yes" },
    });
  }

  out.push({
    kind: "expand_airports",
    label: "Revisar códigos IATA o aeropuertos cercanos",
    patch: {},
  });

  return out.slice(0, 3);
}

/**
 * Recuperación usable sin LLM (parse fallido o adapter degradado).
 */
export function buildDeterministicFlightRecoveryNeedInput(
  ctx: FlightRecoveryContext,
): {
  assistantMessage: string;
  missingSlots: PlannerMissingSlot[];
  suggestions: FlightRecoverySuggestion[];
} {
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

  return {
    assistantMessage: assistantMessage.trim(),
    missingSlots,
    suggestions: buildDeterministicRecoverySuggestions(ctx),
  };
}
