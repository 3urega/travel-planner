import crypto from "crypto";

import { Service } from "diod";

import { PostgresAuditRepository } from "../../infrastructure/postgres/PostgresAuditRepository";
import type { AuditEvent, AuditActor, AuditEventType } from "../../domain/AuditEvent";

type LogParams = {
  sessionId: string;
  type: AuditEventType;
  actor: AuditActor;
  planId?: string;
  stepId?: string;
  reason?: string;
  payloadSnapshot?: Record<string, unknown>;
  approvalId?: string;
};

/**
 * Registra eventos de auditoría en Postgres.
 * Nunca lanza excepciones al flujo principal: si falla el guardado,
 * escribe en consola y continúa — la auditoría no debe detener la operación.
 */
@Service()
export class AuditLogger {
  constructor(private readonly repository: PostgresAuditRepository) {}

  async log(params: LogParams): Promise<AuditEvent> {
    const event: AuditEvent = {
      id: crypto.randomUUID(),
      sessionId: params.sessionId,
      planId: params.planId ?? null,
      stepId: params.stepId ?? null,
      type: params.type,
      actor: params.actor,
      reason: params.reason ?? null,
      payloadSnapshot: params.payloadSnapshot ?? null,
      approvalId: params.approvalId ?? null,
      createdAt: new Date(),
    };

    try {
      await this.repository.save(event);
    } catch (err) {
      console.error("[AuditLogger] failed to persist event:", event.type, err);
    }

    return event;
  }

  async getSessionHistory(sessionId: string): Promise<AuditEvent[]> {
    try {
      return await this.repository.findBySessionId(sessionId);
    } catch {
      return [];
    }
  }
}
