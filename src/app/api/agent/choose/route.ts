import "reflect-metadata";

import { NextResponse } from "next/server";

import { ChooseOptionService } from "@/contexts/travel/trip/application/choose/ChooseOptionService";
import { container } from "@/contexts/shared/infrastructure/dependency-injection/diod.config";
import { HttpNextResponse } from "@/contexts/shared/infrastructure/http/HttpNextResponse";

const chooseOptionService = container.get(ChooseOptionService);

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
  const decisionId = typeof o.decisionId === "string" ? o.decisionId.trim() : "";
  const chosenOptionId =
    typeof o.chosenOptionId === "string" ? o.chosenOptionId.trim() : "";
  const graphVersionId =
    typeof o.graphVersionId === "string" ? o.graphVersionId.trim() : undefined;

  if (!sessionId || !decisionId || !chosenOptionId) {
    return HttpNextResponse.badRequest(
      "sessionId, decisionId y chosenOptionId son obligatorios.",
    );
  }

  try {
    const result = await chooseOptionService.choose({
      sessionId,
      decisionId,
      chosenOptionId,
      graphVersionId,
    });

    if (!result.ok) {
      return HttpNextResponse.badRequest(result.error);
    }

    return HttpNextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error interno al registrar la elección.";
    return HttpNextResponse.internalError(message);
  }
}
