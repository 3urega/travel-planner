import type { DecisionWeights } from "./DecisionRecord";

/**
 * Preferencias opcionales enviadas desde la UI (POST /api/agent).
 */
export type UserTravelPreferences = {
  maxPriceUsd?: number;
  /** 0–1: importancia relativa del precio frente al confort. */
  priceWeight?: number;
  comfortWeight?: number;
};

export type ResolvedUserTravelPreferences = {
  maxPriceUsd?: number;
  weights: DecisionWeights;
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

  return {
    maxPriceUsd,
    weights: { price, comfort },
  };
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
  };
  return normalizeUserTravelPreferences(merged);
}
