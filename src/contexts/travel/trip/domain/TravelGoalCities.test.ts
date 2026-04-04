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

  it("infiere 'de X a Y' (español habitual: ir de Barcelona a Copenhague)", () => {
    const r = TravelGoalCities.inferFromGoal(
      "Quiero ir de barcelona a copenhague las navidades del 2026",
    );
    expect(r.from).toBe("barcelona");
    expect(r.to).toBe("copenhague");
  });

  it("infiere 'from X to Y' en inglés", () => {
    const r = TravelGoalCities.inferFromGoal(
      "I want to fly from Lisbon to Dublin next summer",
    );
    expect(r.from).toBe("Lisbon");
    expect(r.to).toBe("Dublin");
  });

  it("usa valores por defecto si no hay coincidencias", () => {
    const r = TravelGoalCities.inferFromGoal("quiero viajar");
    expect(r.from).toBe("Origin");
    expect(r.to).toBe("Destination");
  });
});
