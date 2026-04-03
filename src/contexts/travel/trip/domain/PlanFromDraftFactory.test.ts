import { describe, expect, it } from "vitest";

import { planFromValidatedDraftBody } from "./PlanFromDraftFactory";

describe("planFromValidatedDraftBody", () => {
  const sessionId = "sess-1";

  it("monta un Plan con reservas forzando approvalRequired", () => {
    const r = planFromValidatedDraftBody(sessionId, {
      goal: "Tokio",
      steps: [
        {
          id: "a",
          type: "search_flights",
          description: "vuelos",
          dependsOn: [],
          args: {},
          approvalRequired: false,
        },
        {
          id: "b",
          type: "book_flight",
          description: "reserva",
          dependsOn: ["a"],
          args: {},
          approvalRequired: false,
        },
      ],
    });
    expect(r?.kind).toBe("plan");
    if (r?.kind !== "plan") return;
    const book = r.plan.steps.find((s) => s.type === "book_flight");
    expect(book?.approvalRequired).toBe(true);
    expect(r.plan.steps.every((s) => s.status === "pending")).toBe(true);
  });

  it("devuelve null si dependsOn apunta a id inexistente", () => {
    const r = planFromValidatedDraftBody(sessionId, {
      goal: "X",
      steps: [
        {
          id: "a",
          type: "search_flights",
          description: "x",
          dependsOn: ["missing"],
          args: {},
          approvalRequired: false,
        },
      ],
    });
    expect(r).toBeNull();
  });

  it("devuelve null si hay ids duplicados", () => {
    const r = planFromValidatedDraftBody(sessionId, {
      goal: "X",
      steps: [
        {
          id: "a",
          type: "search_flights",
          description: "1",
          dependsOn: [],
          args: {},
          approvalRequired: false,
        },
        {
          id: "a",
          type: "search_hotels",
          description: "2",
          dependsOn: [],
          args: {},
          approvalRequired: false,
        },
      ],
    });
    expect(r).toBeNull();
  });
});
