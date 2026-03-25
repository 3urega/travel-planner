"use client";

import { useMemo } from "react";

import type { ATOResponse } from "@/contexts/travel/trip/domain/ATOResponse";

import { deriveWorkflowState } from "./deriveWorkflowState";
import type { WorkspaceWorkflowState } from "./types";

export function useWorkspaceWorkflow(
  response: ATOResponse | null,
  options?: {
    hasGoalText?: boolean;
    slotsComplete?: boolean;
  },
): WorkspaceWorkflowState {
  return useMemo(
    () => deriveWorkflowState(response, options),
    [response, options?.hasGoalText, options?.slotsComplete],
  );
}
