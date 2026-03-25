import crypto from "crypto";

import { Service } from "diod";
import { z } from "zod";

import { OpenAIClient } from "../../infrastructure/ai/OpenAIClient";
import type { PlanStepType, PlanStepStatus } from "../../domain/Plan";
import type { PlannerGenerateResult, PlannerMissingSlot } from "../../domain/PlannerResult";
import type { ResolvedUserTravelPreferences } from "../../domain/UserTravelPreferences";

/** Fechas calendario ya recogidas en los ids habituales del planner. */
function hasCoreDateSlots(gathered: Record<string, string>): boolean {
  const iso = (s: string | undefined) =>
    s !== undefined && /^\d{4}-\d{2}-\d{2}$/.test(s.trim());
  const ob = gathered.outbound ?? gathered.outbound_date;
  const ret = gathered.return ?? gathered.return_date;
  return iso(ob) && iso(ret);
}

function inferCityPair(goal: string): { from: string; to: string } {
  const g = goal.trim();
  const en = g.match(
    /\ben\s+([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){0,2})\b/i,
  );
  const toCity = en?.[1]?.trim() ?? "Destination";
  const desde = g.match(
    /\b(?:desde|from)\s+([A-Za-zÀ-ÿ]+(?:\s+[A-Za-zÀ-ÿ]+){0,2})\b/i,
  );
  const fromCity = desde?.[1]?.trim() ?? "Origin";
  return { from: fromCity, to: toCity };
}

/** Cuando ida y vuelta ya están en calendario: una sola vía ejecutable; no tiene sentido volver a pedir fechas al usuario. */
const PLAN_WITH_CONFIRMED_DATES_SYSTEM_PROMPT = `You are a travel planning orchestrator. The user has ALREADY provided concrete outbound and return calendar dates in [CONFIRMED travel data].

OUTPUT ONLY valid JSON — no markdown, no explanation, no code fences.

You MUST return kind "plan" only (never need_input for schedules — those dates are final).

Shape:
{
  "kind": "plan",
  "goal": "brief travel goal in the user's language",
  "steps": [ 3 to 6 steps: search_flights, search_hotels, evaluate_options, propose_plan in order; book_* optional last with approvalRequired true ]
}

Rules:
- search_flights.args: from, to, date (YYYY-MM-DD from the outbound date in confirmed data)
- search_hotels.args: city (destination inferred from user message if possible, else "Destination"), check_in / check_out from confirmed outbound/return dates
- Use ONLY the dates from [CONFIRMED travel data]; do not ask for more input
- dependsOn must reflect execution order`;

const planStepSchema = z.object({
  id: z.string().min(1),
  type: z.enum([
    "search_flights",
    "search_hotels",
    "evaluate_options",
    "propose_plan",
    "simulate",
    "request_approval",
    "book_flight",
    "book_hotel",
  ]),
  description: z.string().min(1),
  dependsOn: z.array(z.string()).default([]),
  args: z.record(z.string(), z.unknown()).default({}),
  approvalRequired: z.boolean().default(false),
});

const slotRoleSchema = z.enum(["outbound_date", "return_date", "destination"]);

const needInputSchema = z.object({
  kind: z.literal("need_input"),
  assistantMessage: z.string().min(1),
  missingSlots: z
    .array(
      z.object({
        id: z.string().min(1),
        role: slotRoleSchema,
        label: z.string().min(1),
      }),
    )
    .min(1)
    .max(5),
});

const planKindSchema = z.object({
  kind: z.literal("plan"),
  goal: z.string().min(1),
  steps: z.array(planStepSchema).min(1).max(8),
});

const plannerUnionSchema = z.discriminatedUnion("kind", [needInputSchema, planKindSchema]);

const SYSTEM_PROMPT = `You are a travel planning orchestrator. Analyze the user's request and [Gathered travel data] if present.

OUTPUT ONLY valid JSON — no markdown, no explanation, no code fences.

You MUST return exactly ONE of two shapes:

1) need_input — when you cannot yet build flight/hotel steps with REAL dates from the user or from [Gathered travel data]:
{
  "kind": "need_input",
  "assistantMessage": "Short question in the same language as the user (why you need the data).",
  "missingSlots": [
    { "id": "outbound", "role": "outbound_date", "label": "Departure date" },
    { "id": "return", "role": "return_date", "label": "Return date" }
  ]
}

- role MUST be one of: outbound_date, return_date, destination
- Use "destination" only if origin/destination cities are unclear for booking.
- If the user gave vague timing ("next Christmas", "in April") without calendar dates, you MUST use need_input and ask for concrete YYYY-MM-DD dates — do NOT invent dates.

2) plan — when outbound and return dates are available (in the message and/or [Gathered travel data]) and you can fill search_flights / search_hotels args with YYYY-MM-DD. If [Gathered travel data] already has both dates as YYYY-MM-DD, you MUST return this shape — never ask for those dates again:
{
  "kind": "plan",
  "goal": "brief description of the travel goal",
  "steps": [ ... ]
}

Plan step rules:
- Valid step types: search_flights, search_hotels, evaluate_options, propose_plan, book_flight, book_hotel
- Ordering: searches before evaluate_options, evaluate_options before propose_plan, book_* last
- book_* steps MUST have approvalRequired: true
- Use ONLY YYYY-MM-DD for dates in args — never guess or fabricate dates
- dependsOn: step ids this step depends on
- 3 to 6 steps; keep focused`;

@Service()
export class PlannerService {
  constructor(private readonly openAIClient: OpenAIClient) {}

  async generate(
    userMessage: string,
    sessionId: string,
    prefs?: ResolvedUserTravelPreferences,
    gatheredSlots?: Record<string, string>,
  ): Promise<PlannerGenerateResult> {
    if (gatheredSlots && hasCoreDateSlots(gatheredSlots)) {
      const planned = await this.generatePlanWithConfirmedDates(
        userMessage,
        sessionId,
        prefs,
        gatheredSlots,
      );
      if (planned.kind === "plan") {
        return planned;
      }
      return this.buildDeterministicPlanFromGathered(
        userMessage,
        sessionId,
        gatheredSlots,
      );
    }

    const client = this.openAIClient.get();
    const model = this.openAIClient.getModel();

    const userContent = this.buildUserContent(userMessage, prefs, gatheredSlots);

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0,
    });

    const content = response.choices[0]?.message.content ?? "";
    return this.parseAndValidate(content, userMessage, sessionId);
  }

  private async generatePlanWithConfirmedDates(
    userMessage: string,
    sessionId: string,
    prefs?: ResolvedUserTravelPreferences,
    gatheredSlots?: Record<string, string>,
  ): Promise<PlannerGenerateResult> {
    const client = this.openAIClient.get();
    const model = this.openAIClient.getModel();
    const slotBlock =
      gatheredSlots && Object.keys(gatheredSlots).length > 0
        ? Object.entries(gatheredSlots)
            .filter(([, v]) => v.trim() !== "")
            .map(([k, v]) => `${k}: ${v}`)
            .join("\n")
        : "";
    const lines: string[] = [userMessage.trim(), ""];
    lines.push("[CONFIRMED travel data — mandatory values for plan steps]");
    lines.push(slotBlock || "(none)");
    if (prefs) {
      lines.push("");
      lines.push("[User preferences]");
      if (prefs.maxPriceUsd !== undefined) {
        lines.push(`Approximate maximum budget: ${prefs.maxPriceUsd} USD.`);
      }
      lines.push(
        `Price vs comfort weights: ${Math.round(prefs.weights.price * 100)}% price / ${Math.round(prefs.weights.comfort * 100)}% comfort.`,
      );
    }
    const forcedContent = lines.join("\n");
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: PLAN_WITH_CONFIRMED_DATES_SYSTEM_PROMPT },
        { role: "user", content: forcedContent },
      ],
      temperature: 0,
    });
    const content = response.choices[0]?.message.content ?? "";
    return this.parseAndValidate(content, userMessage, sessionId);
  }

  private buildDeterministicPlanFromGathered(
    userMessage: string,
    sessionId: string,
    gathered: Record<string, string>,
  ): PlannerGenerateResult {
    const ob = (gathered.outbound ?? gathered.outbound_date ?? "").trim();
    const ret = (gathered.return ?? gathered.return_date ?? "").trim();
    const { from, to } = inferCityPair(userMessage);
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

  private buildUserContent(
    userMessage: string,
    prefs?: ResolvedUserTravelPreferences,
    gatheredSlots?: Record<string, string>,
  ): string {
    const parts: string[] = [userMessage.trim()];

    if (prefs) {
      const lines: string[] = [];
      if (prefs.maxPriceUsd !== undefined) {
        lines.push(
          `Approximate maximum budget: ${prefs.maxPriceUsd} USD (use for searches and cost-aware steps).`,
        );
      }
      lines.push(
        `Price vs comfort weights: ${Math.round(prefs.weights.price * 100)}% price / ${Math.round(prefs.weights.comfort * 100)}% comfort.`,
      );
      parts.push(`\n\n[User preferences]\n${lines.join(" ")}`);
    }

    if (gatheredSlots && Object.keys(gatheredSlots).length > 0) {
      parts.push("\n\n[Gathered travel data — use these values in plan steps; do NOT ask for them again]");
      for (const [k, v] of Object.entries(gatheredSlots)) {
        if (v.trim() !== "") parts.push(`${k}: ${v}`);
      }
    }

    return parts.join("\n");
  }

  private parseAndValidate(
    raw: string,
    userMessage: string,
    sessionId: string,
  ): PlannerGenerateResult {
    const now = new Date();

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : raw;

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return this.fallbackNeedInput(userMessage);
    }

    const validated = plannerUnionSchema.safeParse(parsed);
    if (!validated.success) {
      return this.fallbackNeedInput(userMessage);
    }

    const data = validated.data;
    if (data.kind === "need_input") {
      return {
        kind: "need_input",
        assistantMessage: data.assistantMessage,
        missingSlots: data.missingSlots as PlannerMissingSlot[],
      };
    }

    return {
      kind: "plan",
      plan: {
        id: crypto.randomUUID(),
        sessionId,
        goal: data.goal,
        steps: data.steps.map((s) => ({
          id: s.id,
          type: s.type as PlanStepType,
          description: s.description,
          status: "pending" as PlanStepStatus,
          dependsOn: s.dependsOn,
          args: s.args,
          approvalRequired: s.approvalRequired,
        })),
        createdAt: now,
        updatedAt: now,
      },
    };
  }

  private fallbackNeedInput(userMessage: string): PlannerGenerateResult {
    return {
      kind: "need_input",
      assistantMessage:
        userMessage.trim().length > 0
          ? "Para continuar necesito fechas concretas de ida y vuelta (calendario) en formato que puedas indicar abajo."
          : "Indica fechas de ida y vuelta para generar el plan.",
      missingSlots: [
        {
          id: "outbound",
          role: "outbound_date",
          label: "Fecha de ida",
        },
        {
          id: "return",
          role: "return_date",
          label: "Fecha de vuelta",
        },
      ],
    };
  }
}
