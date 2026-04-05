import { describe, expect, it } from "vitest";

import {
  applyFlightRefinementFilters,
  curateFlightOptions,
  type CuratableFlightOffer,
} from "./FlightOptionCurator";

function offer(
  partial: Omit<CuratableFlightOffer, "id"> & { id?: string },
): CuratableFlightOffer {
  return {
    id: partial.id ?? `gen-${partial.airline}-${partial.departureTime}-${partial.price}`,
    airline: partial.airline,
    price: partial.price,
    departureTime: partial.departureTime,
    arrivalTime: partial.arrivalTime,
    stops: partial.stops,
    durationMinutes: partial.durationMinutes,
    displayLabel: partial.displayLabel,
  };
}

describe("curateFlightOptions", () => {
  it("deduplica y devuelve shortlist acotada con varios buckets", () => {
    const rows: CuratableFlightOffer[] = [
      offer({
        id: "1",
        airline: "AA",
        price: 800,
        departureTime: "08:00",
        arrivalTime: "14:00",
        stops: 2,
        durationMinutes: 480,
      }),
      offer({
        id: "2",
        airline: "AA",
        price: 800,
        departureTime: "08:00",
        arrivalTime: "14:00",
        stops: 2,
        durationMinutes: 480,
      }),
      offer({
        id: "3",
        airline: "BB",
        price: 200,
        departureTime: "06:30",
        arrivalTime: "22:00",
        stops: 1,
        durationMinutes: 600,
      }),
      offer({
        id: "4",
        airline: "CC",
        price: 350,
        departureTime: "11:00",
        arrivalTime: "13:30",
        stops: 0,
        durationMinutes: 150,
      }),
      offer({
        id: "5",
        airline: "DD",
        price: 400,
        departureTime: "09:00",
        arrivalTime: "12:00",
        stops: 0,
        durationMinutes: 180,
      }),
      offer({
        id: "6",
        airline: "EE",
        price: 420,
        departureTime: "10:00",
        arrivalTime: "11:30",
        stops: 0,
        durationMinutes: 90,
      }),
      offer({
        id: "7",
        airline: "FF",
        price: 280,
        departureTime: "12:00",
        arrivalTime: "15:00",
        stops: 0,
        durationMinutes: 180,
      }),
      offer({
        id: "8",
        airline: "GG",
        price: 310,
        departureTime: "14:00",
        arrivalTime: "20:00",
        stops: 0,
        durationMinutes: 360,
      }),
      offer({
        id: "9",
        airline: "HH",
        price: 500,
        departureTime: "07:00",
        arrivalTime: "09:00",
        stops: 0,
        durationMinutes: 120,
      }),
      offer({
        id: "10",
        airline: "II",
        price: 520,
        departureTime: "16:00",
        arrivalTime: "18:30",
        stops: 0,
        durationMinutes: 150,
      }),
    ];

    const curated = curateFlightOptions(rows);

    expect(curated.totalEligible).toBeLessThan(rows.length);
    expect(curated.shortlist.length).toBeGreaterThanOrEqual(3);
    expect(curated.shortlist.length).toBeLessThanOrEqual(5);
    expect(curated.shortlist.some((f) => f.id === "3")).toBe(true);
    const nonstopId = curated.recommendationGroups.nonstop;
    expect(nonstopId).toBeDefined();
    const directTags = curated.tagsByFlightId.get(nonstopId!) ?? [];
    expect(directTags).toContain("Directo");
  });

  it("descarta ofertas basura", () => {
    const curated = curateFlightOptions([
      offer({
        id: "bad-price",
        airline: "X",
        price: 0,
        departureTime: "10:00",
        arrivalTime: "12:00",
        stops: 0,
      }),
      offer({
        id: "bad-dep",
        airline: "Y",
        price: 100,
        departureTime: "00:00",
        arrivalTime: "12:00",
        stops: 0,
      }),
      offer({
        id: "ok",
        airline: "Z",
        price: 100,
        departureTime: "09:00",
        arrivalTime: "11:00",
        stops: 0,
        durationMinutes: 120,
      }),
    ]);
    expect(curated.totalEligible).toBe(1);
    expect(curated.shortlist.map((f) => f.id)).toEqual(["ok"]);
  });

  it("applyFlightRefinementFilters respeta maxStops y maxPriceUsd", () => {
    const rows: CuratableFlightOffer[] = [
      offer({
        id: "a",
        airline: "A",
        price: 500,
        departureTime: "09:00",
        arrivalTime: "12:00",
        stops: 0,
      }),
      offer({
        id: "b",
        airline: "B",
        price: 800,
        departureTime: "10:00",
        arrivalTime: "15:00",
        stops: 2,
      }),
      offer({
        id: "c",
        airline: "C",
        price: 400,
        departureTime: "14:00",
        arrivalTime: "18:00",
        stops: 1,
      }),
    ];
    const byStops = applyFlightRefinementFilters(rows, { maxStops: 0 });
    expect(byStops.map((f) => f.id)).toEqual(["a"]);
    const byPrice = applyFlightRefinementFilters(rows, { maxPriceUsd: 450 });
    expect(byPrice.map((f) => f.id)).toEqual(["c"]);
  });

  it("applyFlightRefinementFilters franja mañana/tarde es suave (no vacía forzada)", () => {
    const rows: CuratableFlightOffer[] = [
      offer({
        id: "pm",
        airline: "P",
        price: 300,
        departureTime: "15:00",
        arrivalTime: "18:00",
        stops: 0,
      }),
    ];
    const morning = applyFlightRefinementFilters(rows, { preferMorning: true });
    expect(morning).toHaveLength(1);
    expect(morning[0]!.id).toBe("pm");
  });

  it("curateFlightOptions aplica refinement antes del bucketing", () => {
    const rows: CuratableFlightOffer[] = [
      offer({
        id: "direct-cheap",
        airline: "X",
        price: 100,
        departureTime: "08:00",
        arrivalTime: "10:00",
        stops: 0,
        durationMinutes: 120,
      }),
      offer({
        id: "stop-expensive",
        airline: "Y",
        price: 50,
        departureTime: "06:00",
        arrivalTime: "22:00",
        stops: 2,
        durationMinutes: 600,
      }),
    ];
    const curated = curateFlightOptions(rows, { maxStops: 0 });
    expect(curated.shortlist.every((f) => f.stops === 0)).toBe(true);
    expect(curated.shortlist.some((f) => f.id === "direct-cheap")).toBe(true);
  });
});
