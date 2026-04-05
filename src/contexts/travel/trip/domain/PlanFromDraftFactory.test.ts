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

  it("devuelve null si hay search_hotels sin depender de search_flights", () => {
    const r = planFromValidatedDraftBody(sessionId, {
      goal: "X",
      steps: [
        {
          id: "h",
          type: "search_hotels",
          description: "hotel",
          dependsOn: [],
          args: {},
          approvalRequired: false,
        },
      ],
    });
    expect(r).toBeNull();
  });

  it("devuelve null si el hotel no enlaza transitivamente con vuelos", () => {
    const r = planFromValidatedDraftBody(sessionId, {
      goal: "X",
      steps: [
        {
          id: "sf",
          type: "search_flights",
          description: "v",
          dependsOn: [],
          args: {},
          approvalRequired: false,
        },
        {
          id: "ev",
          type: "evaluate_options",
          description: "e",
          dependsOn: [],
          args: {},
          approvalRequired: false,
        },
        {
          id: "h",
          type: "search_hotels",
          description: "h",
          dependsOn: ["ev"],
          args: {},
          approvalRequired: false,
        },
      ],
    });
    expect(r).toBeNull();
  });

  it("corrige Origin/Destination del LLM usando routeInferenceText", () => {
    const r = planFromValidatedDraftBody(
      sessionId,
      {
        goal: "Viaje navideño",
        steps: [
          {
            id: "sf",
            type: "search_flights",
            description: "vuelos",
            dependsOn: [],
            args: {
              from: "Origin",
              to: "Destination",
              date: "2026-12-20",
            },
            approvalRequired: false,
          },
          {
            id: "sh",
            type: "search_hotels",
            description: "hotel",
            dependsOn: ["sf"],
            args: {
              city: "Copenhague",
              check_in: "2026-12-20",
              check_out: "2026-12-27",
            },
            approvalRequired: false,
          },
        ],
      },
      {
        routeInferenceText:
          "Quiero ir de barcelona a copenhague las navidades del 2026",
      },
    );
    expect(r?.kind).toBe("plan");
    if (r?.kind !== "plan") return;
    const sf = r.plan.steps.find((s) => s.type === "search_flights");
    expect(sf?.args.from).toBe("barcelona");
    expect(sf?.args.to).toBe("copenhague");
  });

  it("acepta hotel que depende transitivamente del paso de vuelo", () => {
    const r = planFromValidatedDraftBody(sessionId, {
      goal: "X",
      steps: [
        {
          id: "sf",
          type: "search_flights",
          description: "v",
          dependsOn: [],
          args: {},
          approvalRequired: false,
        },
        {
          id: "h",
          type: "search_hotels",
          description: "h",
          dependsOn: ["sf"],
          args: {},
          approvalRequired: false,
        },
      ],
    });
    expect(r?.kind).toBe("plan");
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
