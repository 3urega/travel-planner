import type { ResolvedUserTravelPreferences } from "./UserTravelPreferences";

export type TravelPlanDraftPromptVariant = "standard" | "confirmed_dates";

/**
 * Entrada al puerto de borrador de plan (sin detalles de transporte LLM).
 */
export type TravelPlanDraftRequest = {
  userMessage: string;
  prefs?: ResolvedUserTravelPreferences;
  gatheredSlots?: Record<string, string>;
  promptVariant: TravelPlanDraftPromptVariant;
};
