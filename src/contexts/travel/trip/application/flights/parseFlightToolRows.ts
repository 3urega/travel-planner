import type { CuratableFlightOffer } from "./FlightOptionCurator";

/** Parsea el resultado crudo de `search_flights` (mismo contrato que `GraphExecutor`). */
export function parseFlightToolRows(data: unknown): CuratableFlightOffer[] {
  if (!Array.isArray(data)) return [];
  const out: CuratableFlightOffer[] = [];
  for (const item of data) {
    if (typeof item !== "object" || item === null) continue;
    const o = item as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id : "";
    if (!id) continue;
    const priceRaw = o.priceUsd ?? o.price;
    const price =
      typeof priceRaw === "number" ? priceRaw : Number(priceRaw);
    if (!Number.isFinite(price)) continue;
    const dep =
      typeof o.departureTime === "string"
        ? o.departureTime
        : typeof o.departure === "string"
          ? o.departure
          : "00:00";
    const arr =
      typeof o.arrivalTime === "string"
        ? o.arrivalTime
        : typeof o.arrival === "string"
          ? o.arrival
          : "00:00";
    const stopsRaw = o.stops;
    const stops =
      typeof stopsRaw === "number"
        ? stopsRaw
        : Number.isFinite(Number(stopsRaw))
          ? Number(stopsRaw)
          : 0;
    const dm = o.durationMinutes;
    const durationMinutes =
      dm !== undefined && Number.isFinite(Number(dm))
        ? Number(dm)
        : undefined;
    const displayLabel =
      typeof o.displayLabel === "string" ? o.displayLabel : undefined;
    out.push({
      id,
      airline: typeof o.airline === "string" ? o.airline : "",
      price,
      departureTime: dep,
      arrivalTime: arr,
      stops,
      durationMinutes,
      displayLabel,
    });
  }
  return out;
}
