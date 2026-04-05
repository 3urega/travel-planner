import { Service } from "diod";

import { buildDeterministicFlightRecoveryNeedInput } from "../../domain/flightRecoveryFallback";
import {
  FlightRecoveryPort,
  type FlightRecoveryContext,
} from "../../domain/FlightRecoveryPort";
import type { PlannerMissingSlot } from "../../domain/PlannerResult";
import { OpenAIClient } from "./OpenAIClient";
import { FLIGHT_RECOVERY_SYSTEM_PROMPT } from "./planner/flightRecoveryPrompts";
import { flightRecoveryNeedInputSchema } from "./planner/plannerDraftSchemas";

@Service()
export class OpenAiFlightRecoveryAdapter extends FlightRecoveryPort {
  constructor(private readonly openAIClient: OpenAIClient) {
    super();
  }

  override async requestNeedInputAfterFlightFailure(
    ctx: FlightRecoveryContext,
  ): Promise<{ assistantMessage: string; missingSlots: PlannerMissingSlot[] }> {
    try {
      const fromLLm = await this.tryLlm(ctx);
      if (fromLLm) return fromLLm;
    } catch {
      /* degradar a fallback */
    }
    return buildDeterministicFlightRecoveryNeedInput(ctx);
  }

  private async tryLlm(
    ctx: FlightRecoveryContext,
  ): Promise<{ assistantMessage: string; missingSlots: PlannerMissingSlot[] } | null> {
    const client = this.openAIClient.get();
    const model = this.openAIClient.getModel();

    const payload = {
      userMessage: ctx.userMessage,
      planGoal: ctx.planGoal,
      flightSearchArgs: ctx.searchFlightArgs,
      error: {
        code: ctx.flightBlock.code,
        reason: ctx.flightBlock.reason,
        stepId: ctx.flightBlock.stepId,
      },
    };

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: FLIGHT_RECOVERY_SYSTEM_PROMPT },
        {
          role: "user",
          content: `[Flight search recovery — reply with JSON only]\n${JSON.stringify(payload, null, 2)}`,
        },
      ],
      temperature: 0,
    });

    const content = response.choices[0]?.message.content ?? "";
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : content;

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return null;
    }

    const validated = flightRecoveryNeedInputSchema.safeParse(parsed);
    if (!validated.success) return null;

    return {
      assistantMessage: validated.data.assistantMessage,
      missingSlots: validated.data.missingSlots,
    };
  }
}
