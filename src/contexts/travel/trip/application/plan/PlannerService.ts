import crypto from "crypto";

import { Service } from "diod";
import { z } from "zod";

import { OpenAIClient } from "../../infrastructure/ai/OpenAIClient";
import type { Plan, PlanStepType, PlanStepStatus } from "../../domain/Plan";
import type { ResolvedUserTravelPreferences } from "../../domain/UserTravelPreferences";

/**
 * Esquema Zod de un paso del plan tal como lo puede devolver el LLM en JSON.
 * - `type`: solo valores permitidos (whitelist); si el modelo inventa otro string, falla la validación.
 * - `dependsOn`: IDs de pasos previos que deben existir para que este tenga sentido (grafo de dependencias).
 * - `args`: parámetros libres que luego usará el orquestador al llamar a tools (origen, destino, fechas…).
 *
 * Importante: esto NO ejecuta herramientas; solo define la “forma” del plan antes de simular/ejecutar.
 */
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

/**
 * Plan completo: objetivo + lista de pasos acotada (mínimo 1, máximo 8) para evitar planes infinitos o vacíos.
 */
const planResponseSchema = z.object({
  goal: z.string().min(1),
  steps: z.array(planStepSchema).min(1).max(8),
});

/**
 * Instrucciones al modelo: debe devolver SOLO JSON parseable (sin markdown).
 * Así el “planner” es explícito: el sistema espera una estructura concreta, no un párrafo libre.
 *
 * El modelo actúa como “redactor del plan”; la validez real la impone Zod después.
 */
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
 * PlannerService — “planner explícito” del ATO.
 *
 * Diferencia clave frente a un bucle solo con *function calling* (como en TravelPlannerUseCase):
 * aquí el modelo **no** elige herramienta a herramienta en tiempo real; en su lugar devuelve **un documento**
 * (JSON) que describe **todo el plan de golpe**: pasos ordenados, tipos, dependencias y argumentos.
 *
 * Flujo mental:
 * 1. Usuario escribe su intención (mensaje libre).
 * 2. Llamamos al LLM con temperature 0 para reducir creatividad excesiva en la forma del JSON.
 * 3. Extraemos el primer objeto JSON `{ ... }` del texto (por si el modelo añade texto alrededor).
 * 4. Validamos con Zod: si algo no cumple el contrato, **no** confiamos ciegamente: usamos un plan mínimo de respaldo.
 * 5. Mapeamos el resultado validado al tipo de dominio `Plan` (IDs de plan, sesión, estado `pending` en cada paso).
 *
 * Así el **sistema** decide qué estructura es aceptable; el LLM solo **propone** contenido dentro de ese marco.
 */
@Service()
export class PlannerService {
  constructor(private readonly openAIClient: OpenAIClient) {}

  /**
   * Genera un `Plan` para una sesión concreta.
   *
   * @param userMessage - Petición del usuario en lenguaje natural.
   * @param sessionId   - Vincula el plan a la sesión ATO (auditoría, persistencia).
   */
  async generate(
    userMessage: string,
    sessionId: string,
    prefs?: ResolvedUserTravelPreferences,
  ): Promise<Plan> {
    const client = this.openAIClient.get();
    const model = this.openAIClient.getModel();

    const userContent = this.buildUserContent(userMessage, prefs);

    /**
     * Una sola llamada a chat completions **sin** tools de function calling.
     * El “output” es el propio contenido del mensaje del asistente, que debe ser JSON.
     * temperature: 0 → respuestas más repetibles y alineadas con el formato pedido.
     */
    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userContent },
      ],
      temperature: 0,
    });

    /**
     * choices[0]: primera (y normalmente única) variante de respuesta del modelo.
     * Si no hay contenido, parseamos cadena vacía y acabaremos en fallback.
     */
    const content = response.choices[0]?.message.content ?? "";
    const plan = this.parseAndValidate(content, userMessage, sessionId);
    return plan;
  }

  /** Añade líneas de preferencias al mensaje del usuario para orientar al LLM. */
  private buildUserContent(
    userMessage: string,
    prefs?: ResolvedUserTravelPreferences,
  ): string {
    if (!prefs) return userMessage;
    const lines: string[] = [];
    if (prefs.maxPriceUsd !== undefined) {
      lines.push(
        `Approximate maximum budget: ${prefs.maxPriceUsd} USD (use for searches and cost-aware steps).`,
      );
    }
    lines.push(
      `Price vs comfort weights: ${Math.round(prefs.weights.price * 100)}% price / ${Math.round(prefs.weights.comfort * 100)}% comfort.`,
    );
    return `${userMessage}\n\n[User preferences]\n${lines.join(" ")}`;
  }

  /**
   * Convierte el texto crudo del modelo en un `Plan` de dominio, o devuelve un plan mínimo si falla.
   */
  private parseAndValidate(
    raw: string,
    userMessage: string,
    sessionId: string,
  ): Plan {
    const now = new Date();

    /**
     * Algunos modelos envuelven el JSON en ```json ... ``` aunque se pidió lo contrario.
     * Buscamos el primer `{` hasta el último `}` para aislar el objeto.
     */
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : raw;

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return this.fallbackPlan(userMessage, sessionId, now);
    }

    /**
     * safeParse no lanza: si falla, devolvemos fallback en lugar de romper el servidor.
     * Así un alucinación del LLM en tipos o campos no tumba todo el pipeline ATO.
     */
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

  /**
   * Plan de respaldo cuando el JSON del modelo es inválido o no pasa Zod.
   * Un solo paso genérico `propose_plan` para que el orquestador pueda seguir (simulación, políticas, etc.)
   * sin quedarse sin estructura.
   */
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
