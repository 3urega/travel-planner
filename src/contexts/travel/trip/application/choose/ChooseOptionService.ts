import { Service } from "diod";

import { AuditLogger } from "../audit/AuditLogger";
import { PostgresAdgGraphRepository } from "../../infrastructure/postgres/PostgresAdgGraphRepository";
import { PostgresSessionRepository } from "../../infrastructure/postgres/PostgresSessionRepository";

export type ChooseOptionResult =
  | { ok: true; chosenOptionId: string }
  | { ok: false; error: string };

@Service()
export class ChooseOptionService {
  constructor(
    private readonly sessionRepository: PostgresSessionRepository,
    private readonly adgRepository: PostgresAdgGraphRepository,
    private readonly auditLogger: AuditLogger,
  ) {}

  async choose(params: {
    sessionId: string;
    decisionId: string;
    chosenOptionId: string;
    graphVersionId?: string;
  }): Promise<ChooseOptionResult> {
    const session = await this.sessionRepository.findById(params.sessionId);
    if (!session) {
      return { ok: false, error: "Sesión no encontrada." };
    }

    if (!params.graphVersionId || params.graphVersionId.trim() === "") {
      return {
        ok: false,
        error: "graphVersionId es obligatorio para persistir la elección en el ADG.",
      };
    }

    const persisted = await this.adgRepository.appendUserDecision(
      params.graphVersionId,
      params.decisionId,
      params.chosenOptionId,
      params.sessionId,
    );

    if (!persisted) {
      return {
        ok: false,
        error: "No se pudo persistir la elección en el grafo ADG.",
      };
    }

    await this.auditLogger.log({
      sessionId: params.sessionId,
      type: "decision_made",
      actor: "user",
      planId: session.planId ?? undefined,
      payloadSnapshot: {
        decisionId: params.decisionId,
        chosenOptionId: params.chosenOptionId,
        graphVersionId: params.graphVersionId,
      },
    });

    return { ok: true, chosenOptionId: params.chosenOptionId };
  }
}
