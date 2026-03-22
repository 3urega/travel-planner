import { Service } from "diod";
import { Pool } from "pg";

import { resolvePostgresConnectionString } from "./resolvePostgresConnectionString";

/**
 * Pool de conexiones PostgreSQL (lazy: no conecta hasta la primera consulta).
 */
@Service()
export class PostgresPool {
  private pool: Pool | null = null;

  get(): Pool {
    if (!this.pool) {
      this.pool = new Pool({
        connectionString: resolvePostgresConnectionString(),
        max: 10,
      });
    }
    return this.pool;
  }
}
