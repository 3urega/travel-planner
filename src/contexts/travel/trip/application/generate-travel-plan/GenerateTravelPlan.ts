import { Service } from "diod";

import { CoreTravelDates } from "../../domain/CoreTravelDates";
import { DefaultLeisureTripPlanTemplate } from "../../domain/DefaultLeisureTripPlanTemplate";
import { planFromValidatedDraftBody } from "../../domain/PlanFromDraftFactory";
import { createPlannerSlotFallback } from "../../domain/PlannerSlotFallback";
import type { PlannerGenerateResult } from "../../domain/PlannerResult";
import { TravelPlanDraftPort } from "../../domain/TravelPlanDraftPort";
import type { ResolvedUserTravelPreferences } from "../../domain/UserTravelPreferences";

@Service()
export class GenerateTravelPlan {
  constructor(private readonly travelPlanDraftPort: TravelPlanDraftPort) {}

  async execute(
    userMessage: string,
    sessionId: string,
    prefs?: ResolvedUserTravelPreferences,
    gatheredSlots?: Record<string, string>,
  ): Promise<PlannerGenerateResult> {
    if (gatheredSlots && CoreTravelDates.areCompleteIn(gatheredSlots)) {
      const draft = await this.travelPlanDraftPort.requestDraft({
        userMessage,
        prefs,
        gatheredSlots,
        promptVariant: "confirmed_dates",
      });

      if (draft.outcome === "plan") {
        const built = planFromValidatedDraftBody(sessionId, draft);
        if (built) return built;
      }

      return DefaultLeisureTripPlanTemplate.build({
        userMessage,
        sessionId,
        gathered: gatheredSlots,
      });
    }

    const draft = await this.travelPlanDraftPort.requestDraft({
      userMessage,
      prefs,
      gatheredSlots,
      promptVariant: "standard",
    });

    if (draft.outcome === "parse_failed") {
      return createPlannerSlotFallback(userMessage);
    }

    if (draft.outcome === "need_input") {
      return {
        kind: "need_input",
        assistantMessage: draft.assistantMessage,
        missingSlots: draft.missingSlots,
      };
    }

    const built = planFromValidatedDraftBody(sessionId, draft);
    if (!built) {
      return createPlannerSlotFallback(userMessage);
    }
    return built;
  }
}
