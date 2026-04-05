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
  });
});
