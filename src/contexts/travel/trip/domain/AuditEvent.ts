/** Quién tomó la acción. */
export type AuditActor = "llm" | "system" | "user";

export type AuditEventType =
  | "session_created"
  | "plan_generated"
  | "simulation_run"
  | "step_started"
  | "step_completed"
  | "step_blocked"
  | "step_failed"
  | "tool_called"
  | "tool_succeeded"
  | "tool_failed"
  | "tool_retried"
  | "approval_requested"
  | "approval_granted"
  | "approval_rejected"
  | "decision_made"
  | "replan_triggered"
  | "session_completed";

/**
 * Evento de auditoría inmutable que responde:
 * qué ocurrió, quién lo decidió, con qué datos y cuándo.
 */
export type AuditEvent = {
  id: string;
  sessionId: string;
  planId: string | null;
  stepId: string | null;
  type: AuditEventType;
  actor: AuditActor;
  reason: string | null;
  payloadSnapshot: Record<string, unknown> | null;
  approvalId: string | null;
  createdAt: Date;
};
