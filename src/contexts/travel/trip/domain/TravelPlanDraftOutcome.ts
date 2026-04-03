import type { PlanStepType } from "./Plan";
import type { PlannerMissingSlot } from "./PlannerResult";

export type TravelPlanDraftStep = {
  id: string;
  type: PlanStepType;
  description: string;
  dependsOn: string[];
  args: Record<string, unknown>;
  approvalRequired: boolean;
};

export type TravelPlanDraftNeedInput = {
  outcome: "need_input";
  assistantMessage: string;
  missingSlots: PlannerMissingSlot[];
};

export type TravelPlanDraftPlanBody = {
  outcome: "plan";
  goal: string;
  steps: TravelPlanDraftStep[];
};

export type TravelPlanDraftParseFailed = {
  outcome: "parse_failed";
};

export type TravelPlanDraftOutcome =
  | TravelPlanDraftNeedInput
  | TravelPlanDraftPlanBody
  | TravelPlanDraftParseFailed;
