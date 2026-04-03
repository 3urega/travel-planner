import type { TravelPlanDraftRequest } from "./TravelPlanDraftRequest";
import type { TravelPlanDraftOutcome } from "./TravelPlanDraftOutcome";

export abstract class TravelPlanDraftPort {
  abstract requestDraft(
    request: TravelPlanDraftRequest,
  ): Promise<TravelPlanDraftOutcome>;
}
