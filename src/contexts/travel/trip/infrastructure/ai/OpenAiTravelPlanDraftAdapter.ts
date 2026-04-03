import { Service } from "diod";

import { TravelPlanDraftPort } from "../../domain/TravelPlanDraftPort";
import type { TravelPlanDraftRequest } from "../../domain/TravelPlanDraftRequest";
import type { TravelPlanDraftOutcome } from "../../domain/TravelPlanDraftOutcome";
import { OpenAIClient } from "./OpenAIClient";
import {
  buildConfirmedDatesUserContent,
  buildStandardTravelPlanUserContent,
} from "./planner/buildTravelPlanUserContent";
import { plannerUnionSchema } from "./planner/plannerDraftSchemas";
import {
  PLAN_WITH_CONFIRMED_DATES_SYSTEM_PROMPT,
  TRAVEL_PLAN_STANDARD_SYSTEM_PROMPT,
} from "./planner/travelPlanDraftPrompts";

@Service()
export class OpenAiTravelPlanDraftAdapter extends TravelPlanDraftPort {
  constructor(private readonly openAIClient: OpenAIClient) {
    super();
  }

  async requestDraft(
    request: TravelPlanDraftRequest,
  ): Promise<TravelPlanDraftOutcome> {
    const client = this.openAIClient.get();
    const model = this.openAIClient.getModel();

    const systemPrompt =
      request.promptVariant === "confirmed_dates"
        ? PLAN_WITH_CONFIRMED_DATES_SYSTEM_PROMPT
        : TRAVEL_PLAN_STANDARD_SYSTEM_PROMPT;

    const userContent =
      request.promptVariant === "confirmed_dates"
        ? buildConfirmedDatesUserContent(
            request.userMessage,
            request.prefs,
            request.gatheredSlots,
          )
        : buildStandardTravelPlanUserContent(
            request.userMessage,
            request.prefs,
            request.gatheredSlots,
          );

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0,
    });

    const content = response.choices[0]?.message.content ?? "";
    return this.parseModelContent(content);
  }

  private parseModelContent(raw: string): TravelPlanDraftOutcome {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : raw;

    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      return { outcome: "parse_failed" };
    }

    const validated = plannerUnionSchema.safeParse(parsed);
    if (!validated.success) {
      return { outcome: "parse_failed" };
    }

    const data = validated.data;
    if (data.kind === "need_input") {
      return {
        outcome: "need_input",
        assistantMessage: data.assistantMessage,
        missingSlots: data.missingSlots,
      };
    }

    return {
      outcome: "plan",
      goal: data.goal,
      steps: data.steps.map((s) => ({
        id: s.id,
        type: s.type,
        description: s.description,
        dependsOn: s.dependsOn,
        args: s.args,
        approvalRequired: s.approvalRequired,
      })),
    };
  }
}
