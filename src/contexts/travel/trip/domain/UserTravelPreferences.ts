import type { DecisionWeights } from "./DecisionRecord";

/** Preferencia de escalas para curación de shortlist (persistida en sesión). */
export type FlightStopsPreferenceInput = "any" | "nonstop" | "one_stop";

/**
 * Preferencias opcionales enviadas desde la UI (POST /api/agent).
 */
export type UserTravelPreferences = {
  maxPriceUsd?: number;
  /** 0–1: importancia relativa del precio frente al confort. */
  priceWeight?: number;
  comfortWeight?: number;
  /** Máximo de escalas (API / avanzado); la UI suele mandar {@link flightStopsPreference}. */
  flightMaxStops?: number;
  flightStopsPreference?: FlightStopsPreferenceInput;
  /** Preferencia suave de franja de salida para la shortlist de vuelos. */
  flightTimeBand?: "any" | "morning" | "afternoon";
};

export type ResolvedUserTravelPreferences = {
  maxPriceUsd?: number;
  weights: DecisionWeights;
  flightMaxStops?: number;
  flightTimeBand?: "morning" | "afternoon";
};

function readNum(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/**
 * Normaliza pesos (0–1) y presupuesto; valores por defecto 0.6 / 0.4.
 */
export function normalizeUserTravelPreferences(
  input: UserTravelPreferences | undefined,
): ResolvedUserTravelPreferences {
  const w = input?.priceWeight;
  const c = input?.comfortWeight;
  let price = 0.6;
  let comfort = 0.4;

  if (w !== undefined && c !== undefined) {
    const sum = w + c;
    if (sum > 0) {
      price = Math.max(0, Math.min(1, w / sum));
      comfort = Math.max(0, Math.min(1, c / sum));
    }
  } else if (w !== undefined) {
    price = Math.max(0, Math.min(1, w));
    comfort = 1 - price;
  } else if (c !== undefined) {
    comfort = Math.max(0, Math.min(1, c));
    price = 1 - comfort;
  }

  const maxRaw = input?.maxPriceUsd;
  const maxPriceUsd =
    maxRaw !== undefined && Number.isFinite(maxRaw) && maxRaw > 0
      ? maxRaw
      : undefined;

  let flightMaxStops: number | undefined;
  if (input?.flightStopsPreference === "nonstop") flightMaxStops = 0;
  else if (input?.flightStopsPreference === "one_stop") flightMaxStops = 1;
  else if (input?.flightStopsPreference === "any") flightMaxStops = undefined;
  else {
    const flightMaxStopsRaw = input?.flightMaxStops;
    flightMaxStops =
      flightMaxStopsRaw !== undefined &&
      Number.isFinite(Number(flightMaxStopsRaw)) &&
      Number(flightMaxStopsRaw) >= 0
        ? Math.floor(Number(flightMaxStopsRaw))
        : undefined;
  }

  const bandRaw = input?.flightTimeBand;
  const flightTimeBand =
    bandRaw === "morning" || bandRaw === "afternoon" ? bandRaw : undefined;

  return {
    maxPriceUsd,
    weights: { price, comfort },
    ...(flightMaxStops !== undefined ? { flightMaxStops } : {}),
    ...(flightTimeBand !== undefined ? { flightTimeBand } : {}),
  };
}

function readFlightTimeBand(
  v: unknown,
): "any" | "morning" | "afternoon" | undefined {
  if (v === "morning" || v === "afternoon" || v === "any") return v;
  return undefined;
}

function readFlightStopsPreference(
  v: unknown,
): FlightStopsPreferenceInput | undefined {
  if (v === "any" || v === "nonstop" || v === "one_stop") return v;
  return undefined;
}

/**
 * Fusiona preferencias persistidas en sesión con las del cuerpo de la petición
 * (los campos definidos en `incoming` sustituyen).
 */
export function mergeUserTravelPreferences(
  existing: Record<string, unknown> | undefined,
  incoming: UserTravelPreferences | undefined,
): ResolvedUserTravelPreferences {
  const merged: UserTravelPreferences = {
    maxPriceUsd: incoming?.maxPriceUsd ?? readNum(existing?.maxPriceUsd),
    priceWeight: incoming?.priceWeight ?? readNum(existing?.priceWeight),
    comfortWeight: incoming?.comfortWeight ?? readNum(existing?.comfortWeight),
    flightStopsPreference:
      incoming?.flightStopsPreference ??
      readFlightStopsPreference(existing?.flightStopsPreference),
    flightMaxStops:
      incoming?.flightMaxStops ??
      readNum(existing?.flightMaxStops as unknown),
    flightTimeBand:
      incoming?.flightTimeBand ??
      readFlightTimeBand(existing?.flightTimeBand),
  };
  return normalizeUserTravelPreferences(merged);
}

/** Lee `gatheredSlots` persistidos en la sesión (id → valor, p. ej. fechas ISO). */
export function readGatheredSlots(
  preferences: Record<string, unknown> | undefined,
): Record<string, string> {
  const g = preferences?.gatheredSlots;
  if (!g || typeof g !== "object" || Array.isArray(g)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(g as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim() !== "") out[k] = v.trim();
  }
  return out;
}

/** Normaliza el mapa enviado por POST /api/agent. */
export function normalizeIncomingSlotValues(
  raw: unknown,
): Record<string, string> | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim() !== "") out[k] = v.trim();
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
