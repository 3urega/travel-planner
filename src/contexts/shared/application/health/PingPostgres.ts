import { Service } from "diod";

import { PostgresPool } from "@/contexts/shared/infrastructure/postgres/PostgresPool";

export type PostgresPingResult = {
  ok: boolean;
  version?: string;
  schemaVersion?: string;
  error?: string;
};

@Service()
export class PingPostgres {
  constructor(private readonly postgresPool: PostgresPool) {}

  async ping(): Promise<PostgresPingResult> {
    try {
      const pool = this.postgresPool.get();
      const versionRes = await pool.query<{ version: string }>(
        "SELECT version() AS version",
      );
      const version = versionRes.rows[0]?.version;

      let schemaVersion: string | undefined;
      try {
        const metaRes = await pool.query<{ value: string }>(
          "SELECT value FROM app_meta WHERE key = 'schema_version' LIMIT 1",
        );
        schemaVersion = metaRes.rows[0]?.value;
      } catch {
        schemaVersion = undefined;
      }

      return { ok: true, version, schemaVersion };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { ok: false, error: message };
    }
  }
}
