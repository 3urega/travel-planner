import "reflect-metadata";

import { NextResponse } from "next/server";

import { GraphSelectService } from "@/contexts/travel/trip/application/graph/GraphSelectService";
import { container } from "@/contexts/shared/infrastructure/dependency-injection/diod.config";
import { HttpNextResponse } from "@/contexts/shared/infrastructure/http/HttpNextResponse";

const graphSelectService = container.get(GraphSelectService);

export async function POST(req: Request): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return HttpNextResponse.badRequest("JSON inválido.");
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return HttpNextResponse.badRequest("Body debe ser un objeto.");
  }

  const o = body as Record<string, unknown>;
  const sessionId = typeof o.sessionId === "string" ? o.sessionId.trim() : "";
  const graphVersionId =
    typeof o.graphVersionId === "string" ? o.graphVersionId.trim() : "";
  const selectionRequestLogicalId =
    typeof o.selectionRequestLogicalId === "string"
      ? o.selectionRequestLogicalId.trim()
      : "";
  const selectedOptionId =
    typeof o.selectedOptionId === "string" ? o.selectedOptionId.trim() : "";

  if (
    !sessionId ||
    !graphVersionId ||
    !selectionRequestLogicalId ||
    !selectedOptionId
  ) {
    return HttpNextResponse.badRequest(
      "sessionId, graphVersionId, selectionRequestLogicalId y selectedOptionId son obligatorios.",
    );
  }

  try {
    const result = await graphSelectService.select({
      sessionId,
      graphVersionId,
      selectionRequestLogicalId,
      selectedOptionId,
    });

    if (!result.ok) {
      return HttpNextResponse.badRequest(result.error);
    }

    return HttpNextResponse.json({
      ok: true,
      message:
        "Selección registrada. Reanuda el POST /api/agent con resumeExecution: true y sessionId.",
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error interno al registrar la selección.";
    return HttpNextResponse.internalError(message);
  }
}
