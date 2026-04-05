import { Service } from "diod";

import {
  buildDeterministicFlightRecoveryNeedInput,
  buildDeterministicRecoverySuggestions,
} from "../../domain/flightRecoveryFallback";
import {
  FlightRecoveryPort,
  type FlightRecoveryContext,
  type FlightRecoveryNeedInputResult,
} from "../../domain/FlightRecoveryPort";
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
  ): Promise<FlightRecoveryNeedInputResult> {
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
  ): Promise<FlightRecoveryNeedInputResult | null> {
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

    const deterministic = buildDeterministicRecoverySuggestions(ctx);
    const fromModel = validated.data.suggestions?.map((s) => ({
      kind: s.kind,
      label: s.label,
      patch: s.patch ?? {},
    }));

    return {
      assistantMessage: validated.data.assistantMessage,
      missingSlots: validated.data.missingSlots,
      suggestions:
        fromModel && fromModel.length > 0
          ? fromModel.slice(0, 3)
          : deterministic,
    };
  }
}
