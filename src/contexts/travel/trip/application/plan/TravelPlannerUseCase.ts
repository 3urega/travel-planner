import { Service } from "diod";
import type OpenAI from "openai";

import { evaluateApproval } from "../../domain/ApprovalGuard";
import type { AgentResponse, ToolTrace, TravelStep } from "../../domain/TravelPlan";
import { getToolSchemas, travelTools } from "../../infrastructure/tools/MockTravelTools";
import { OpenAIClient } from "../../infrastructure/ai/OpenAIClient";

/**
 * Caso de uso principal del “agente de viajes”.
 *
 * Idea general (sin jerga innecesaria):
 * 1. Enviamos al modelo de lenguaje el mensaje del usuario y una lista de “herramientas”
 *    que el modelo PUEDE decidir invocar (buscar vuelos, hoteles, etc.).
 * 2. El modelo responde de dos formas: o bien escribe texto final, o bien pide ejecutar
 *    una o más herramientas con argumentos concretos (function calling).
 * 3. Si pide herramientas, nosotros las ejecutamos (o las bloqueamos si la política de
 *    aprobación lo exige), guardamos el resultado y volvemos a preguntar al modelo
 *    con esa información añadida a la conversación.
 * 4. Repetimos hasta que el modelo devuelve un texto de cierre (sin más llamadas a tools)
 *    o hasta un número máximo de vueltas por seguridad.
 *
 * Esto NO es un chat simple: el modelo “razona” en varios pasos y puede combinar varias tools.
 */
@Service()
export class TravelPlannerUseCase {
  constructor(private readonly openAIClient: OpenAIClient) {}

  async plan(userMessage: string): Promise<AgentResponse> {
    // Cliente HTTP hacia OpenAI u Ollama (API compatible). El modelo concreto viene de env (ej. llama3.1:8b).
    const client = this.openAIClient.get();
    const model = this.openAIClient.getModel();

    // Esquemas JSON que el modelo ve como “funciones disponibles”. No ejecutan nada solos: solo describen qué puede pedir.
    const toolSchemas = getToolSchemas();

    /**
     * Historial de la conversación en formato que entiende la API de chat.
     * - system: instrucciones fijas de comportamiento (rol del asistente).
     * - user: lo que escribió la persona.
     * - assistant: respuestas del modelo (texto o peticiones de tool).
     * - tool: resultados que nosotros inyectamos después de ejecutar una herramienta.
     * Cada vuelta del bucle reutiliza y amplía este array.
     */
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `Eres un agente de planificación de viajes. Tu objetivo es:
1. Entender la petición del usuario.
2. Usar las herramientas disponibles para buscar opciones reales (vuelos, hoteles, itinerario).
3. Proponer un plan estructurado con pasos concretos y costes estimados.
4. NUNCA ejecutar reservas sin indicar que requieren aprobación del usuario.
5. Responder siempre en español.`,
      },
      { role: "user", content: userMessage },
    ];

    // Auditoría humana: qué tools se tocaron y con qué resultado (para la UI y trazabilidad).
    const traces: ToolTrace[] = [];
    const steps: TravelStep[] = [];
    let finalAnswer = "";

    let continueLoop = true;
    let iterations = 0;

    while (continueLoop && iterations < 5) {
      iterations++;

      /**
       * Llamada a la API de “chat completions” con tools.
       * - El modelo decide si responde texto o si devuelve tool_calls (peticiones de ejecución).
       * - tool_choice: "auto" = el modelo elige; podría forzarse a "none" o a una tool concreta en otros casos.
       */
      const response = await client.chat.completions.create({
        model,
        messages,
        tools: toolSchemas,
        tool_choice: "auto",
      });

      const choice = response.choices[0];
      const assistantMessage = choice.message;
      // Guardamos la respuesta del asistente en el historial para que la siguiente iteración tenga contexto.
      messages.push(assistantMessage);

      if (choice.finish_reason === "tool_calls" && assistantMessage.tool_calls) {
        /**
         * El modelo NO ha terminado aún: ha pedido ejecutar una o más funciones.
         * Para cada una: localizamos la implementación, aplicamos reglas de negocio (aprobación),
         * ejecutamos o devolvemos bloqueo, y añadimos al historial un mensaje role: "tool"
         * con el resultado en JSON (así el modelo puede seguir en la siguiente vuelta).
         */
        for (const toolCall of assistantMessage.tool_calls) {
          if (toolCall.type !== "function") continue;
          const toolName = toolCall.function.name;
          const rawArgs = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
          const toolDef = travelTools[toolName];

          const estimatedCost = toolDef?.estimateCost?.(rawArgs);
          const approval = evaluateApproval(toolName, estimatedCost);

          let toolResult: unknown;
          if (approval.status === "pending") {
            // Política de seguridad: no ejecutamos la acción real; el modelo recibe el motivo.
            toolResult = {
              blocked: true,
              reason: approval.reason,
              message: "Acción pendiente de aprobación del usuario. No ejecutada.",
            };
          } else if (toolDef) {
            toolResult = await toolDef.execute(rawArgs);
          } else {
            toolResult = { error: `Herramienta "${toolName}" no encontrada.` };
          }

          const trace: ToolTrace = {
            toolName,
            args: rawArgs,
            result: toolResult,
            approvalStatus: approval.status,
            approvalReason: approval.reason,
            estimatedCost,
          };
          traces.push(trace);

          steps.push({
            id: `step-${steps.length + 1}`,
            description: `Herramienta: ${toolName}`,
            toolTrace: trace,
          });

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(toolResult),
          });
        }
        // Tras procesar todas las tool_calls, el bucle while vuelve a llamar al modelo
        // con messages ya enriquecido con los resultados (nueva ronda de "razonamiento").
      } else {
        /**
         * finish_reason típico: "stop" (u otro distinto de tool_calls).
         * El modelo devuelve texto final para el usuario; aquí termina el bucle.
         */
        finalAnswer = assistantMessage.content ?? "";
        continueLoop = false;
      }
    }

    const pendingApprovals = traces
      .filter((t) => t.approvalStatus === "pending")
      .map((t) => t.approvalReason ?? `Requiere aprobación: ${t.toolName}`);

    const totalEstimatedCost = traces.reduce(
      (sum, t) => sum + (t.estimatedCost ?? 0),
      0,
    );

    return {
      rawAnswer: finalAnswer,
      plan: {
        destination: this.extractDestination(userMessage),
        summary: finalAnswer,
        steps,
        totalEstimatedCost,
        requiresApproval: pendingApprovals.length > 0,
        pendingApprovals,
      },
    };
  }

  /**
   * Heurística ligera solo para mostrar un encabezado en la UI; no es extracción semántica del modelo.
   */
  private extractDestination(message: string): string {
    const match = /\b([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?: [A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)*)\b/.exec(message);
    return match?.[1] ?? "Destino no especificado";
  }
}
