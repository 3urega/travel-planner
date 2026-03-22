/**
 * Resuelve la cadena de conexión a PostgreSQL.
 * Prioridad: `DATABASE_URL`; si no existe, compone desde `POSTGRES_*` (valores por defecto alineados con docker-compose).
 */
export function resolvePostgresConnectionString(): string {
  const direct = process.env.DATABASE_URL?.trim();
  if (direct && direct.length > 0) {
    return direct;
  }

  const host = process.env.POSTGRES_HOST?.trim() ?? "localhost";
  const port = process.env.POSTGRES_PORT?.trim() ?? "15432";
  const user = process.env.POSTGRES_USER?.trim() ?? "travel";
  const password = process.env.POSTGRES_PASSWORD?.trim() ?? "travel_dev";
  const database = process.env.POSTGRES_DB?.trim() ?? "ai_travel_agent";

  const u = encodeURIComponent(user);
  const p = encodeURIComponent(password);

  return `postgresql://${u}:${p}@${host}:${port}/${database}`;
}
