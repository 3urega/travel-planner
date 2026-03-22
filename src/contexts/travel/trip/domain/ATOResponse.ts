import type { Plan } from "./Plan";
import type { SimulationResult } from "./SimulationResult";
import type { DecisionRecord } from "./DecisionRecord";
import type { AuditEvent } from "./AuditEvent";
import type { ApprovalLevel } from "./ApprovalPolicy";

export type PendingApprovalItem = {
  stepId: string;
  stepType: string;
  description: string;
  level: ApprovalLevel;
  reason: string;
  estimatedCost?: number;
  args: Record<string, unknown>;
};

/**
 * Respuesta completa del operador autónomo:
 * plan estructurado + simulación + decisiones + aprobaciones + auditoría.
 */
export type ATOResponse = {
  sessionId: string;
  plan: Plan;
  simulation: SimulationResult;
  decisions: DecisionRecord[];
  pendingApprovals: PendingApprovalItem[];
  executedSteps: Array<{ stepId: string; result: unknown }>;
  auditEvents: AuditEvent[];
  summary: string;
  /** ADG (Hito 1): grafo persistido tras generar el plan; ausente si falló la escritura. */
  adgGraphId?: string;
  adgGraphVersionId?: string;
};
