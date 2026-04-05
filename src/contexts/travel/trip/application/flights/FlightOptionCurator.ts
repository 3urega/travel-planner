import { buildFlightComfortProxy, type FlightComfortInput } from "./buildFlightComfortProxy";
import type { FlightRefinementFilters } from "./flightRefinementTypes";

/** Fila de oferta alineada con el parseo de `GraphExecutor` / herramienta de vuelos. */
export type CuratableFlightOffer = {
  id: string;
  airline: string;
  price: number;
  departureTime: string;
  arrivalTime: string;
  stops: number;
  durationMinutes?: number;
  displayLabel?: string;
};

const BUCKET_LABELS = {
  cheapest: "Más barato",
  balanced: "Mejor equilibrio",
  fastest: "Más rápido",
  nonstop: "Directo",
  mostComfortable: "Más cómodo",
} as const;

export type FlightBucketKey = keyof typeof BUCKET_LABELS;

export type CuratedFlightSelection = {
  /** Ofertas válidas tras filtrar basura (antes de shortlist). */
  totalEligible: number;
  shortlist: CuratableFlightOffer[];
  comfortById: Map<string, number>;
  /** Etiquetas de bucket por id (p. ej. una opción puede ser "Más barato" y "Directo"). */
  tagsByFlightId: Map<string, string[]>;
  /** Repetición de qué bucket aportó cada etiqueta (para trazabilidad / tests). */
  recommendationGroups: Partial<Record<FlightBucketKey, string>>;
};

function toComfortInput(f: CuratableFlightOffer): FlightComfortInput {
  return {
    stops: f.stops,
    durationMinutes: f.durationMinutes,
    departureTime: f.departureTime,
    arrivalTime: f.arrivalTime,
  };
}

function priceMarginOk(a: number, b: number): boolean {
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const tol = Math.max(5, 0.02 * lo);
  return hi - lo <= tol;
}

function dedupeOffers(offers: CuratableFlightOffer[]): CuratableFlightOffer[] {
  const kept: CuratableFlightOffer[] = [];
  for (const o of offers) {
    const dup = kept.some(
      (k) =>
        k.airline === o.airline &&
        k.departureTime === o.departureTime &&
        k.stops === o.stops &&
        priceMarginOk(k.price, o.price),
    );
    if (!dup) kept.push(o);
  }
  return kept;
}

function filterEligible(offers: CuratableFlightOffer[]): CuratableFlightOffer[] {
  return offers.filter(
    (f) =>
      f.price > 0 &&
      Boolean(f.departureTime?.trim()) &&
      f.departureTime.trim() !== "00:00" &&
      Number.isFinite(f.stops),
  );
}

function departureMinutes(hhmm: string): number | null {
  const parts = hhmm.trim().split(":");
  if (parts.length < 2) return null;
  const h = Number(parts[0]);
  const m = Number(parts[1]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
}

/**
 * Restricciones duras (escalas, precio) reducen el conjunto; franjas horarias son preferencias suaves
 * (si no queda ninguna, se ignora la franja).
 */
export function applyFlightRefinementFilters(
  offers: CuratableFlightOffer[],
  filters?: FlightRefinementFilters,
): CuratableFlightOffer[] {
  if (!filters) return offers;
  let working = offers;

  if (filters.maxStops !== undefined) {
    working = working.filter((f) => f.stops <= filters.maxStops!);
  }
  if (
    filters.maxPriceUsd !== undefined &&
    Number.isFinite(filters.maxPriceUsd)
  ) {
    working = working.filter((f) => f.price <= filters.maxPriceUsd!);
  }

  if (filters.preferMorning) {
    const sub = working.filter((f) => {
      const dm = departureMinutes(f.departureTime);
      return dm !== null && dm < 12 * 60;
    });
    if (sub.length > 0) working = sub;
  } else if (filters.preferAfternoon) {
    const sub = working.filter((f) => {
      const dm = departureMinutes(f.departureTime);
      return dm !== null && dm >= 12 * 60 && dm < 18 * 60;
    });
    if (sub.length > 0) working = sub;
  }

  return working;
}

function pickMinBy<T>(items: T[], score: (t: T) => number): T | null {
  if (items.length === 0) return null;
  let best = items[0];
  let bestS = score(best);
  for (let i = 1; i < items.length; i++) {
    const s = score(items[i]);
    if (s < bestS) {
      best = items[i];
      bestS = s;
    }
  }
  return best;
}

function pickMaxBy<T>(items: T[], score: (t: T) => number): T | null {
  if (items.length === 0) return null;
  let best = items[0];
  let bestS = score(best);
  for (let i = 1; i < items.length; i++) {
    const s = score(items[i]);
    if (s > bestS) {
      best = items[i];
      bestS = s;
    }
  }
  return best;
}

function defaultBalanceScore(
  f: CuratableFlightOffer,
  minPrice: number,
  priceRange: number,
  comfort: number,
): number {
  const priceScore = 1 - (f.price - minPrice) / priceRange;
  return 0.6 * priceScore + 0.4 * comfort;
}

const MAX_SHORTLIST = 5;
const MIN_SHORTLIST = 3;

/**
 * Dedup, buckets (más barato, equilibrio, más rápido, directo, más cómodo) y shortlist 3–5 ids únicos.
 */
export function curateFlightOptions(
  offers: CuratableFlightOffer[],
  refinement?: FlightRefinementFilters,
): CuratedFlightSelection {
  const refined = applyFlightRefinementFilters(offers, refinement);
  const eligible = dedupeOffers(filterEligible(refined));
  const comfortById = new Map<string, number>();
  for (const f of eligible) {
    comfortById.set(f.id, buildFlightComfortProxy(toComfortInput(f)));
  }

  const tagsByFlightId = new Map<string, string[]>();
  const recommendationGroups: Partial<Record<FlightBucketKey, string>> = {};

  const addTag = (id: string, key: FlightBucketKey) => {
    const label = BUCKET_LABELS[key];
    const cur = tagsByFlightId.get(id) ?? [];
    if (!cur.includes(label)) cur.push(label);
    tagsByFlightId.set(id, cur);
    if (recommendationGroups[key] === undefined) {
      recommendationGroups[key] = id;
    }
  };

  if (eligible.length === 0) {
    return {
      totalEligible: 0,
      shortlist: [],
      comfortById,
      tagsByFlightId,
      recommendationGroups,
    };
  }

  const prices = eligible.map((x) => x.price);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  const cheapest = pickMinBy(eligible, (x) => x.price);
  if (cheapest) addTag(cheapest.id, "cheapest");

  let balancedBest: CuratableFlightOffer | null = null;
  let bestBal = -Infinity;
  for (const f of eligible) {
    const c = comfortById.get(f.id) ?? 0;
    const bal = defaultBalanceScore(f, minPrice, priceRange, c);
    if (bal > bestBal) {
      bestBal = bal;
      balancedBest = f;
    }
  }
  if (balancedBest) addTag(balancedBest.id, "balanced");

  const withDur = eligible.filter(
    (f) => f.durationMinutes !== undefined && Number.isFinite(f.durationMinutes),
  );
  const fastest = pickMinBy(
    withDur.length > 0 ? withDur : eligible,
    (x) =>
      x.durationMinutes !== undefined && Number.isFinite(x.durationMinutes)
        ? x.durationMinutes
        : Number.POSITIVE_INFINITY,
  );
  if (fastest) addTag(fastest.id, "fastest");

  const nonstops = eligible.filter((f) => f.stops === 0);
  const nonstopPick = nonstops.length
    ? pickMinBy(nonstops, (x) => x.price)
    : null;
  if (nonstopPick) addTag(nonstopPick.id, "nonstop");

  const mostComfortable = pickMaxBy(eligible, (f) => comfortById.get(f.id) ?? 0);
  if (mostComfortable) addTag(mostComfortable.id, "mostComfortable");

  const order: CuratableFlightOffer[] = [];
  const seen = new Set<string>();
  const pushUnique = (f: CuratableFlightOffer | null) => {
    if (!f || seen.has(f.id)) return;
    seen.add(f.id);
    order.push(f);
  };

  pushUnique(cheapest);
  pushUnique(balancedBest);
  pushUnique(fastest);
  pushUnique(nonstopPick);
  pushUnique(mostComfortable);

  if (order.length < MIN_SHORTLIST) {
    const rest = [...eligible].sort((a, b) => {
      const ca = comfortById.get(a.id) ?? 0;
      const cb = comfortById.get(b.id) ?? 0;
      const ba =
        defaultBalanceScore(a, minPrice, priceRange, ca) -
        defaultBalanceScore(b, minPrice, priceRange, cb);
      if (Math.abs(ba) > 1e-6) return -ba;
      return a.price - b.price;
    });
    for (const f of rest) {
      pushUnique(f);
      if (order.length >= MIN_SHORTLIST) break;
    }
  }

  const shortlist = order.slice(0, MAX_SHORTLIST);

  return {
    totalEligible: eligible.length,
    shortlist,
    comfortById,
    tagsByFlightId,
    recommendationGroups,
  };
}
