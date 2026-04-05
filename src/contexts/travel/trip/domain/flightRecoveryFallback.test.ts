import { describe, expect, it } from "vitest";

import { buildDeterministicFlightRecoveryNeedInput } from "./flightRecoveryFallback";

describe("buildDeterministicFlightRecoveryNeedInput", () => {
  it("incluye fechas extra si no hubo ofertas", () => {
    const r = buildDeterministicFlightRecoveryNeedInput({
      userMessage: "hola",
      planGoal: "g",
      flightBlock: {
        stepId: "s1",
        code: "no_flight_offers",
        reason: "vacío",
      },
      searchFlightArgs: {},
    });
    expect(r.missingSlots.length).toBe(4);
    expect(r.missingSlots.some((x) => x.role === "outbound_date")).toBe(true);
    expect(r.suggestions.length).toBeGreaterThan(0);
  });

  it("solo origen y destino si el tool falló", () => {
    const r = buildDeterministicFlightRecoveryNeedInput({
      userMessage: "hola",
      planGoal: "g",
      flightBlock: {
        stepId: "s1",
        code: "flight_tool_failed",
        reason: "Origin",
      },
      searchFlightArgs: {},
    });
    expect(r.missingSlots.length).toBe(2);
    expect(Array.isArray(r.suggestions)).toBe(true);
  });

  it("sugiere desplazar fecha si searchFlightArgs tiene date ISO", () => {
    const r = buildDeterministicFlightRecoveryNeedInput({
      userMessage: "hola",
      planGoal: "g",
      flightBlock: {
        stepId: "s1",
        code: "no_flight_offers",
        reason: "vacío",
      },
      searchFlightArgs: { date: "2026-12-10", from: "BCN", to: "CDG" },
    });
    expect(
      r.suggestions.some((s) => s.kind === "shift_date"),
    ).toBe(true);
    expect(
      r.suggestions.some((s) => "recovery_outbound" in s.patch),
    ).toBe(true);
  });
});
