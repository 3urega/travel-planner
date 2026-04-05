import { describe, expect, it } from "vitest";

import { MockFlightSearchAdapter } from "../flights/MockFlightSearchAdapter";
import { TravelToolCatalog } from "./TravelToolCatalog";

describe("TravelToolCatalog", () => {
  it("expone search_flights que delega en FlightSearchPort y serializa ofertas", async () => {
    const catalog = new TravelToolCatalog(new MockFlightSearchAdapter());
    const tools = catalog.getTools();
    const def = tools.search_flights;
    expect(def).toBeDefined();

    const result = await def.execute({
      from: "BCN",
      to: "CDG",
      date: "2026-12-23",
    });

    expect(Array.isArray(result)).toBe(true);
    const rows = result as Record<string, unknown>[];
    expect(rows.length).toBe(3);
    expect(rows[0].id).toBeDefined();
    expect(rows[0].displayLabel).toBeDefined();
    expect(rows[0].priceUsd).toBeDefined();
    expect(rows[0].price).toBe(rows[0].priceUsd);
  });

  it("getToolSchemas incluye search_flights y hoteles", () => {
    const catalog = new TravelToolCatalog(new MockFlightSearchAdapter());
    const names = new Set(
      catalog.getToolSchemas().map((s) => s.function.name),
    );
    expect(names.has("search_flights")).toBe(true);
    expect(names.has("search_hotels")).toBe(true);
    expect(names.has("book_flight")).toBe(true);
  });

  it("search_flights rechaza origen o destino placeholder (Origin/Destination)", async () => {
    const catalog = new TravelToolCatalog(new MockFlightSearchAdapter());
    const def = catalog.getTools().search_flights;
    await expect(
      def.execute({
        from: "Origin",
        to: "CDG",
        date: "2026-12-23",
      }),
    ).rejects.toThrow(/placeholders/);
  });
});
