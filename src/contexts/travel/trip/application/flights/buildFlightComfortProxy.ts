import type { NormalizedFlightOffer } from "../../domain/NormalizedFlightOffer";

/** Campos mínimos para la heurística de confort (compatible con `NormalizedFlightOffer`). */
export type FlightComfortInput = Pick<
  NormalizedFlightOffer,
  "stops" | "durationMinutes" | "departureTime" | "arrivalTime"
>;

function timeToMinutes(hhmm: string): number | null {
  const parts = hhmm.trim().split(":");
  if (parts.length < 2) return null;
  const h_ = Number(parts[0]);
  const m_ = Number(parts[1]);
  if (!Number.isFinite(h_) || !Number.isFinite(m_)) return null;
  return h_ * 60 + m_;
}

/**
 * Heurística explicable 0–1: escalas, duración larga, horarios incómodos y bonus por directo.
 */
export function buildFlightComfortProxy(offer: FlightComfortInput): number {
  let score = 1.0;

  const stops = Math.max(0, offer.stops);
  score -= 0.15 * stops;

  const dm = offer.durationMinutes;
  if (dm !== undefined && Number.isFinite(dm) && dm > 6 * 60) {
    const excess = dm - 6 * 60;
    const span = 6 * 60;
    score -= 0.1 * Math.min(1, excess / span);
  }

  const depMin = timeToMinutes(offer.departureTime);
  if (depMin !== null && depMin < 7 * 60) {
    score -= 0.1;
  }

  const arrMin = timeToMinutes(offer.arrivalTime);
  if (arrMin !== null && arrMin > 23 * 60) {
    score -= 0.1;
  }

  if (stops === 0) {
    score += 0.05;
  }

  return Math.max(0, Math.min(1, score));
}
