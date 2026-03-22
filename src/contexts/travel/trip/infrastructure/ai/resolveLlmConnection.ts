export type LlmProviderKind = "openai" | "ollama";

export type LlmConnection = {
  provider: LlmProviderKind;
  /** OpenAI SDK: omit for api.openai.com; set for Ollama or proxies. */
  baseURL: string | undefined;
  apiKey: string;
  model: string;
};

const DEFAULT_OLLAMA_BASE = "http://localhost:11434/v1";
const DEFAULT_OPENAI_MODEL = "gpt-4.1";
/** Nombre exacto como en `ollama list` / `GET /api/tags` (ej. `llama3.1:8b`). */
const DEFAULT_OLLAMA_MODEL = "llama3.1:8b";

function normalizeOllamaBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/$/, "");
  if (trimmed.endsWith("/v1")) {
    return trimmed;
  }
  return `${trimmed}/v1`;
}

/**
 * Lee variables de entorno y devuelve la conexión al backend compatible con OpenAI Chat Completions.
 *
 * - `LLM_PROVIDER=ollama` (por defecto): Ollama local o remoto vía `OLLAMA_BASE_URL`.
 * - `LLM_PROVIDER=openai`: API oficial u otra base con `OPENAI_BASE_URL` opcional.
 */
export function resolveLlmConnection(): LlmConnection {
  const rawProvider = (process.env.LLM_PROVIDER ?? "ollama").toLowerCase();
  const provider: LlmProviderKind =
    rawProvider === "openai" ? "openai" : "ollama";

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
    const baseURL = process.env.OPENAI_BASE_URL?.trim();
    const model = process.env.LLM_MODEL?.trim() ?? DEFAULT_OPENAI_MODEL;

    return {
      provider: "openai",
      baseURL: baseURL && baseURL.length > 0 ? baseURL : undefined,
      apiKey: apiKey.length > 0 ? apiKey : "missing-openai-key",
      model,
    };
  }

  const baseURL = normalizeOllamaBaseUrl(
    process.env.OLLAMA_BASE_URL?.trim() ?? DEFAULT_OLLAMA_BASE,
  );
  const apiKey =
    process.env.OLLAMA_API_KEY?.trim() ??
    process.env.OPENAI_API_KEY?.trim() ??
    "ollama";
  const model = process.env.LLM_MODEL?.trim() ?? DEFAULT_OLLAMA_MODEL;

  return {
    provider: "ollama",
    baseURL,
    apiKey,
    model,
  };
}
