import { Service } from "diod";

import { PostgresPool } from "@/contexts/shared/infrastructure/postgres/PostgresPool";
import type { AuditEvent, AuditActor, AuditEventType } from "../../domain/AuditEvent";

type AuditEventRow = {
  id: string;
  session_id: string;
  plan_id: string | null;
  step_id: string | null;
  type: string;
  actor: string;
  reason: string | null;
  payload_snapshot: Record<string, unknown> | null;
  approval_id: string | null;
  created_at: Date;
};

@Service()
export class PostgresAuditRepository {
  constructor(private readonly pool: PostgresPool) {}

  async save(event: AuditEvent): Promise<void> {
    await this.pool.get().query(
      `INSERT INTO ato_audit_event
         (id, session_id, plan_id, step_id, type, actor, reason, payload_snapshot, approval_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10)`,
      [
        event.id,
        event.sessionId,
        event.planId,
        event.stepId,
        event.type,
        event.actor,
        event.reason,
        event.payloadSnapshot ? JSON.stringify(event.payloadSnapshot) : null,
        event.approvalId,
        event.createdAt,
      ],
    );
  }

  async findBySessionId(sessionId: string): Promise<AuditEvent[]> {
    const res = await this.pool.get().query<AuditEventRow>(
      `SELECT id, session_id, plan_id, step_id, type, actor, reason, payload_snapshot, approval_id, created_at
       FROM ato_audit_event
       WHERE session_id = $1
       ORDER BY created_at ASC`,
      [sessionId],
    );
    return res.rows.map((row) => ({
      id: row.id,
      sessionId: row.session_id,
      planId: row.plan_id,
      stepId: row.step_id,
      type: row.type as AuditEventType,
      actor: row.actor as AuditActor,
      reason: row.reason,
      payloadSnapshot: row.payload_snapshot,
      approvalId: row.approval_id,
      createdAt: row.created_at,
    }));
  }
}
