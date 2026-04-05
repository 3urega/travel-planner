import type { ResolvedUserTravelPreferences } from "../../domain/UserTravelPreferences";

/** Filtros locales al re-curar vuelos sin nueva búsqueda al proveedor. */
export type FlightRefinementFilters = {
  maxStops?: number;
  maxPriceUsd?: number;
  preferMorning?: boolean;
  preferAfternoon?: boolean;
};

/** Deriva filtros de curación inicial desde preferencias de usuario (Sprint 2). */
export function flightRefinementFromResolvedPrefs(
  p: ResolvedUserTravelPreferences,
): FlightRefinementFilters | undefined {
  const f: FlightRefinementFilters = {};
  if (
    p.flightMaxStops !== undefined &&
    Number.isFinite(p.flightMaxStops) &&
    p.flightMaxStops >= 0
  ) {
    f.maxStops = p.flightMaxStops;
  }
  if (p.flightTimeBand === "morning") f.preferMorning = true;
  if (p.flightTimeBand === "afternoon") f.preferAfternoon = true;
  return Object.keys(f).length > 0 ? f : undefined;
}
