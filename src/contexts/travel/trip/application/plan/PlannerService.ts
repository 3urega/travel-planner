import crypto from "crypto";

import { Service } from "diod";
import { z } from "zod";

import { OpenAIClient } from "../../infrastructure/ai/OpenAIClient";
import type { Plan, PlanStepType, PlanStepStatus } from "../../domain/Plan";
import type { PlannerGenerateResult, PlannerMissingSlot } from "../../domain/PlannerResult";
import type { ResolvedUserTravelPreferences } from "../../domain/UserTravelPreferences";

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

2) plan — when outbound and return dates are available (in the message and/or [Gathered travel data]) and you can fill search_flights / search_hotels args with YYYY-MM-DD:
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
