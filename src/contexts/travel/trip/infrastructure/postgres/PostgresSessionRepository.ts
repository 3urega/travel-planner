import { Service } from "diod";

import { PostgresPool } from "@/contexts/shared/infrastructure/postgres/PostgresPool";
import type { Session, SessionStatus } from "../../domain/Session";

type SessionRow = {
  id: string;
  goal: string;
  status: string;
  plan_id: string | null;
  preferences: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
};

@Service()
export class PostgresSessionRepository {
  constructor(private readonly pool: PostgresPool) {}

  async save(session: Session): Promise<void> {
    await this.pool.get().query(
      `INSERT INTO ato_session (id, goal, status, plan_id, preferences, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
       ON CONFLICT (id) DO UPDATE
         SET goal       = EXCLUDED.goal,
             status     = EXCLUDED.status,
             plan_id    = EXCLUDED.plan_id,
             preferences = EXCLUDED.preferences,
             updated_at = EXCLUDED.updated_at`,
      [
        session.id,
        session.goal,
        session.status,
        session.planId,
        JSON.stringify(session.preferences),
        session.createdAt,
        session.updatedAt,
      ],
    );
  }

  async findById(id: string): Promise<Session | null> {
    const res = await this.pool.get().query<SessionRow>(
      `SELECT id, goal, status, plan_id, preferences, created_at, updated_at
       FROM ato_session WHERE id = $1`,
      [id],
    );
    const row = res.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      goal: row.goal,
      status: row.status as SessionStatus,
      planId: row.plan_id,
      preferences: row.preferences,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
