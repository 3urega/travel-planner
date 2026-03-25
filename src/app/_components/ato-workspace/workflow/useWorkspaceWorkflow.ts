"use client";

import { useMemo } from "react";

import type { ATOResponse } from "@/contexts/travel/trip/domain/ATOResponse";

import { deriveWorkflowState } from "./deriveWorkflowState";
import type { WorkspaceWorkflowState } from "./types";

export function useWorkspaceWorkflow(
  response: ATOResponse | null,
  hasGoalText: boolean,
  slotsComplete: boolean,
): WorkspaceWorkflowState {
  return useMemo(
    () => deriveWorkflowState(response, { hasGoalText, slotsComplete }),
    [response, hasGoalText, slotsComplete],
  );
}
