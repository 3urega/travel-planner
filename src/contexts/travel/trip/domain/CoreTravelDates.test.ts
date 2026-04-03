import { describe, expect, it } from "vitest";

import { CoreTravelDates } from "./CoreTravelDates";

describe("CoreTravelDates", () => {
  it("es true cuando outbound y return son ISO en ids alternativos", () => {
    expect(
      CoreTravelDates.areCompleteIn({
        outbound: "2026-06-01",
        return: "2026-06-10",
      }),
    ).toBe(true);
    expect(
      CoreTravelDates.areCompleteIn({
        outbound_date: "2026-06-01",
        return_date: "2026-06-10",
      }),
    ).toBe(true);
    expect(
      CoreTravelDates.areCompleteIn({
        outbound: "2026-06-01",
        return_date: "2026-06-10",
      }),
    ).toBe(true);
  });

  it("es false si falta una fecha o el formato no es ISO", () => {
    expect(CoreTravelDates.areCompleteIn({ outbound: "2026-06-01" })).toBe(
      false,
    );
    expect(
      CoreTravelDates.areCompleteIn({
        outbound: "2026-06-01",
        return: "10/06/2026",
      }),
    ).toBe(false);
    expect(
      CoreTravelDates.areCompleteIn({
        outbound: "next week",
        return: "2026-06-10",
      }),
    ).toBe(false);
  });

  it("acepta espacios alrededor de fechas ISO", () => {
    expect(
      CoreTravelDates.areCompleteIn({
        outbound: " 2026-06-01 ",
        return: " 2026-06-10",
      }),
    ).toBe(true);
  });
});
