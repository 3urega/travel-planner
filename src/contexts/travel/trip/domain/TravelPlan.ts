export type ApprovalStatus = "approved" | "pending" | "blocked";

export type ToolTrace = {
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
  approvalStatus: ApprovalStatus;
  approvalReason?: string;
  estimatedCost?: number;
};

export type TravelStep = {
  id: string;
  description: string;
  toolTrace?: ToolTrace;
};

export type TravelPlan = {
  destination: string;
  summary: string;
  steps: TravelStep[];
  totalEstimatedCost: number;
  requiresApproval: boolean;
  pendingApprovals: string[];
};

export type AgentResponse = {
  plan: TravelPlan;
  rawAnswer: string;
};
