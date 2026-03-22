import { Service } from "diod";
import OpenAI from "openai";

import { resolveLlmConnection } from "./resolveLlmConnection";
import type { LlmConnection } from "./resolveLlmConnection";

/**
 * Cliente Chat Completions compatible con OpenAI (incluye Ollama en `/v1`).
 */
@Service()
export class OpenAIClient {
  private client: OpenAI | null = null;
  private readonly connection: LlmConnection = resolveLlmConnection();

  get(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: this.connection.apiKey,
        baseURL: this.connection.baseURL,
      });
    }
    return this.client;
  }

  getModel(): string {
    return this.connection.model;
  }

  getConnection(): LlmConnection {
    return this.connection;
  }
}
