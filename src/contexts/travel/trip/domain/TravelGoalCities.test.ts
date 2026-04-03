import { describe, expect, it } from "vitest";

import { TravelGoalCities } from "./TravelGoalCities";

describe("TravelGoalCities", () => {
  it("infiere destino con 'en' e origen con 'desde'", () => {
    const r = TravelGoalCities.inferFromGoal(
      "Viaje de vacaciones desde Madrid en París",
    );
    expect(r.from).toBe("Madrid");
    expect(r.to).toBe("París");
  });

  it("infiere origen con 'from' en inglés", () => {
    const r = TravelGoalCities.inferFromGoal("Trip from Barcelona en Roma");
    expect(r.from).toBe("Barcelona");
    expect(r.to).toBe("Roma");
  });

  it("usa valores por defecto si no hay coincidencias", () => {
    const r = TravelGoalCities.inferFromGoal("quiero viajar");
    expect(r.from).toBe("Origin");
    expect(r.to).toBe("Destination");
  });
});
