import type { ToolDefinition } from "./MockTravelTools";

export type ToolExecutionResult =
  | { success: true; data: unknown; attempts: number }
  | { success: false; error: string; attempts: number };

const MAX_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 5000;
/** Base para backoff exponencial: 100ms, 200ms, 400ms entre reintentos. */
const BACKOFF_BASE_MS = 100;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Tool timeout after ${ms}ms`)),
      ms,
    );
    promise.then(
      (v) => { clearTimeout(timer); resolve(v); },
      (e) => { clearTimeout(timer); reject(e as Error); },
    );
  });
}

/**
 * Ejecuta una herramienta con reintentos y timeout.
 * - Hasta 3 intentos.
 * - Backoff exponencial entre reintentos.
 * - Timeout por defecto 5 s; `tool.timeoutMs` lo sobrescribe (p. ej. búsqueda de vuelos).
 * - Devuelve un resultado tipado (success/failure) sin lanzar excepción.
 */
export async function executeWithResilience(
  tool: ToolDefinition,
  args: Record<string, unknown>,
): Promise<ToolExecutionResult> {
  let lastError = "Unknown error";
  const timeoutMs = tool.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const data = await withTimeout(tool.execute(args), timeoutMs);
      return { success: true, data, attempts: attempt };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt < MAX_RETRIES) {
        await new Promise<void>((r) =>
          setTimeout(r, BACKOFF_BASE_MS * Math.pow(2, attempt - 1)),
        );
      }
    }
  }

  return { success: false, error: lastError, attempts: MAX_RETRIES };
}
