import type { ATOResponse } from "@/contexts/travel/trip/domain/ATOResponse";
import type { PlanStepType } from "@/contexts/travel/trip/domain/Plan";

export type HeaderTripMeta = {
  title: string;
  route: string;
  dates: string;
  travelers: string;
};

export type TripStatusBadge = {
  label: string;
  variant: "default" | "success" | "warning" | "accent" | "muted";
};

const STEP_ORDER: PlanStepType[] = [
  "search_flights",
  "search_hotels",
  "evaluate_options",
  "propose_plan",
  "simulate",
  "request_approval",
  "book_flight",
  "book_hotel",
];

function firstStepArg(
  steps: { type: PlanStepType; args: Record<string, unknown> }[],
  type: PlanStepType,
  key: string,
): string | undefined {
  const s = steps.find((x) => x.type === type);
  if (!s) return undefined;
  const v = s.args[key];
  return typeof v === "string" ? v : undefined;
}

export function buildTripHeaderMeta(response: ATOResponse | null): HeaderTripMeta {
  if (!response) {
    return {
      title: "Nuevo itinerario",
      route: "—",
      dates: "—",
      travelers: "—",
    };
  }

  const steps = response.plan.steps;
  const from = firstStepArg(steps, "search_flights", "from") ?? "Origen";
  const to =
    firstStepArg(steps, "search_flights", "to") ??
    firstStepArg(steps, "search_hotels", "city") ??
    "Destino";
  const d1 =
    firstStepArg(steps, "search_flights", "date") ??
    firstStepArg(steps, "search_hotels", "check_in");
  const d2 = firstStepArg(steps, "search_hotels", "check_out");

  const title =
    response.plan.goal && response.plan.goal.length < 80
      ? response.plan.goal
      : `${to} · itinerario`;

  return {
    title,
    route: `${from} → ${to}`,
    dates:
      d1 && d2 ? `${d1} — ${d2}` : d1 ? `${d1}` : "Define fechas con el agente",
    travelers: "Definir",
  };
}

export function buildTripStatusBadge(
  response: ATOResponse | null,
): TripStatusBadge {
  if (!response) {
    return { label: "Sin sesión", variant: "muted" as const };
  }
  switch (response.phase) {
    case "awaiting_input":
      return { label: "Planificación", variant: "accent" };
    case "awaiting_selection":
      return { label: "Esperando tu elección", variant: "warning" };
    case "ready":
      if (response.pendingApprovals.length > 0) {
        return { label: "Listo para aprobación", variant: "warning" };
      }
      return { label: "Completado", variant: "success" };
    default:
      return { label: "Activo", variant: "default" };
  }
}

export type StageRow = {
  id: string;
  label: string;
  state: "locked" | "waiting" | "active" | "completed";
};

export function deriveProgressStages(
  response: ATOResponse | null,
): StageRow[] {
  if (!response) {
    return [
      { id: "plan", label: "Plan y datos", state: "locked" },
      { id: "flights", label: "Vuelos", state: "locked" },
      { id: "hotels", label: "Hotel", state: "locked" },
      { id: "sim", label: "Simulación", state: "locked" },
      { id: "appr", label: "Aprobación", state: "locked" },
    ];
  }

  const hasSearchFlights = response.plan.steps.some(
    (s) => s.type === "search_flights",
  );
  const hasSearchHotels = response.plan.steps.some(
    (s) => s.type === "search_hotels",
  );
  const phase = response.phase;

  const sel = response.pendingSelections?.[0];
  const flightWaiting =
    phase === "awaiting_selection" && sel?.selectionKind === "flight";
  const hotelWaiting =
    phase === "awaiting_selection" && sel?.selectionKind === "hotel";

  const flightDone =
    response.decisions.some((d) => d.category === "flight") &&
    !flightWaiting &&
    (phase === "ready" || phase === "awaiting_selection" || hotelWaiting);
  const hotelDone =
    response.decisions.some((d) => d.category === "hotel") &&
    !hotelWaiting &&
    phase === "ready";

  let planState: StageRow["state"] = "completed";
  if (phase === "awaiting_input") planState = "active";
  else if (phase === "awaiting_selection" || phase === "ready")
    planState = "completed";

  const flightsState: StageRow["state"] = !hasSearchFlights
    ? "locked"
    : flightWaiting
      ? "waiting"
      : phase === "awaiting_input"
        ? "locked"
        : flightDone
          ? "completed"
          : phase === "ready" && response.decisions.some((d) => d.category === "flight")
            ? "completed"
            : "active";

  const hotelsState: StageRow["state"] = !hasSearchHotels
    ? "locked"
    : hotelWaiting
      ? "waiting"
      : !flightDone && hasSearchFlights
        ? "locked"
        : hotelDone
          ? "completed"
          : flightDone
            ? "active"
            : "locked";

  const simState: StageRow["state"] =
    phase === "ready" && response.simulation.feasible
      ? "completed"
      : phase === "ready"
        ? "completed"
        : response.simulation.totalEstimatedCost > 0 &&
            !response.simulation.humanSummary.includes("Completa")
          ? "completed"
          : phase === "awaiting_input"
            ? "locked"
            : "active";

  const apprState: StageRow["state"] =
    response.pendingApprovals.length > 0
      ? "waiting"
      : phase === "ready" && response.pendingApprovals.length === 0
        ? "completed"
        : "locked";

  return [
    { id: "plan", label: "Plan y datos", state: planState },
    { id: "flights", label: "Vuelos", state: flightsState },
    { id: "hotels", label: "Hotel", state: hotelsState },
    { id: "sim", label: "Simulación", state: simState },
    { id: "appr", label: "Aprobación / ejecución", state: apprState },
  ];
}

export function planStepOrderIndex(type: PlanStepType): number {
  const i = STEP_ORDER.indexOf(type);
  return i === -1 ? 99 : i;
}
