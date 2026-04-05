import { describe, expect, it } from "vitest";

import { buildFlightComfortProxy } from "./buildFlightComfortProxy";

describe("buildFlightComfortProxy", () => {
  it("prioriza vuelo directo corto en horario civil frente a escala larga y nocturna", () => {
    const direct = buildFlightComfortProxy({
      stops: 0,
      durationMinutes: 120,
      departureTime: "10:00",
      arrivalTime: "12:00",
    });

    const rough = buildFlightComfortProxy({
      stops: 2,
      durationMinutes: 600,
      departureTime: "06:00",
      arrivalTime: "23:30",
    });

    expect(direct).toBeGreaterThan(rough);
    expect(direct).toBeGreaterThanOrEqual(0.9);
    expect(rough).toBeLessThan(0.75);
  });

  it("aclampa el resultado al intervalo [0, 1]", () => {
    const worst = buildFlightComfortProxy({
      stops: 8,
      durationMinutes: 24 * 60,
      departureTime: "04:00",
      arrivalTime: "23:45",
    });
    expect(worst).toBe(0);
    expect(
      buildFlightComfortProxy({
        stops: 0,
        departureTime: "12:00",
        arrivalTime: "14:00",
      }),
    ).toBeLessThanOrEqual(1);
  });
});
