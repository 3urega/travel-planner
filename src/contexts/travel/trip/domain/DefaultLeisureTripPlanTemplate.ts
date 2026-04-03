import crypto from "crypto";

import type { PlannerGenerateResult } from "./PlannerResult";
import { TravelGoalCities } from "./TravelGoalCities";

/**
 * Plantilla determinista cuando hay fechas confirmadas pero el LLM no devuelve un plan válido.
 */
export class DefaultLeisureTripPlanTemplate {
  static build(params: {
    userMessage: string;
    sessionId: string;
    gathered: Record<string, string>;
  }): PlannerGenerateResult {
    const { userMessage, sessionId, gathered } = params;
    const ob = (gathered.outbound ?? gathered.outbound_date ?? "").trim();
    const ret = (gathered.return ?? gathered.return_date ?? "").trim();
    const { from, to } = TravelGoalCities.inferFromGoal(userMessage);
    const now = new Date();
    const goal =
      userMessage.trim().length > 0
        ? userMessage.trim().slice(0, 280)
        : `Viaje ${from} → ${to}`;
    return {
      kind: "plan",
      plan: {
        id: crypto.randomUUID(),
        sessionId,
        goal,
        steps: [
          {
            id: "step-search-flights",
            type: "search_flights",
            description: `Buscar vuelos ${from} → ${to} (ida ${ob})`,
            status: "pending",
            dependsOn: [],
            args: { from, to, date: ob },
            approvalRequired: false,
          },
          {
            id: "step-search-hotels",
            type: "search_hotels",
            description: `Buscar estancias en ${to} (${ob} → ${ret})`,
            status: "pending",
            dependsOn: ["step-search-flights"],
            args: { city: to, check_in: ob, check_out: ret },
            approvalRequired: false,
          },
          {
            id: "step-evaluate",
            type: "evaluate_options",
            description: "Evaluar opciones con preferencias del viajero",
            status: "pending",
            dependsOn: ["step-search-flights", "step-search-hotels"],
            args: {},
            approvalRequired: false,
          },
          {
            id: "step-propose",
            type: "propose_plan",
            description: "Proponer itinerario coherente",
            status: "pending",
            dependsOn: ["step-evaluate"],
            args: {},
            approvalRequired: false,
          },
        ],
        createdAt: now,
        updatedAt: now,
      },
    };
  }
}
