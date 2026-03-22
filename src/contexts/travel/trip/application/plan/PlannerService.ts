import crypto from "crypto";

import { Service } from "diod";
import { z } from "zod";

import { OpenAIClient } from "../../infrastructure/ai/OpenAIClient";
import type { Plan, PlanStepType, PlanStepStatus } from "../../domain/Plan";

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

const planResponseSchema = z.object({
  goal: z.string().min(1),
  steps: z.array(planStepSchema).min(1).max(8),
});

const SYSTEM_PROMPT = `You are a travel planning orchestrator. Given a user's travel request, generate a structured execution plan as JSON.

OUTPUT ONLY valid JSON — no markdown, no explanation, no code fences.

Format:
{
  "goal": "brief description of the travel goal",
  "steps": [
    {
      "id": "step-1",
      "type": "search_flights",
      "description": "Search for flights from X to Y on date Z",
      "dependsOn": [],
      "args": { "from": "Madrid", "to": "Tokyo", "date": "2026-04-01" },
      "approvalRequired": false
    }
  ]
}

RULES:
- Valid step types: search_flights, search_hotels, evaluate_options, propose_plan, book_flight, book_hotel
- Ordering: searches always come before evaluate_options, evaluate_options before propose_plan, book_* always last
- book_* steps MUST have approvalRequired: true
- Use YYYY-MM-DD for dates; infer reasonable dates from context if not given
- dependsOn: array of step ids this step depends on (preserve dependency order)
- 3 to 6 steps maximum; keep the plan focused`;

/**
 * Genera un plan estructurado a partir de la intención del usuario.
 * El LLM propone la estructura; el sistema la valida con Zod.
 * Si el LLM devuelve JSON inválido, se crea un plan de fallback mínimo.
 */
@Service()
export class PlannerService {
  constructor(private readonly openAIClient: OpenAIClient) {}

  async generate(userMessage: string, sessionId: string): Promise<Plan> {
    const client = this.openAIClient.get();
    const model = this.openAIClient.getModel();

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userMessage },
      ],
      temperature: 0,
    });

    const content = response.choices[0]?.message.content ?? "";
    const plan = this.parseAndValidate(content, userMessage, sessionId);
    return plan;
  }

  private parseAndValidate(
    raw: string,
    userMessage: string,
    sessionId: string,
  ): Plan {
    const now = new Date();

    // Strip markdown fences if the model added them despite instructions
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : raw;

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return this.fallbackPlan(userMessage, sessionId, now);
    }

    const validated = planResponseSchema.safeParse(parsed);
    if (!validated.success) {
      return this.fallbackPlan(userMessage, sessionId, now);
    }

    return {
      id: crypto.randomUUID(),
      sessionId,
      goal: validated.data.goal,
      steps: validated.data.steps.map((s) => ({
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
    };
  }

  private fallbackPlan(
    userMessage: string,
    sessionId: string,
    now: Date,
  ): Plan {
    return {
      id: crypto.randomUUID(),
      sessionId,
      goal: userMessage,
      steps: [
        {
          id: "step-1",
          type: "propose_plan",
          description: "Proponer plan de viaje basado en la petición del usuario",
          status: "pending",
          dependsOn: [],
          args: {},
          approvalRequired: false,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };
  }
}
