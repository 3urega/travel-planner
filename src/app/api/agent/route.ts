import "reflect-metadata";

import { NextResponse } from "next/server";

import { ATOOrchestrator } from "@/contexts/travel/trip/application/orchestrate/ATOOrchestrator";
import { container } from "@/contexts/shared/infrastructure/dependency-injection/diod.config";
import { HttpNextResponse } from "@/contexts/shared/infrastructure/http/HttpNextResponse";

const orchestrator = container.get(ATOOrchestrator);

export async function POST(req: Request): Promise<NextResponse> {
  const body = await req.json() as { message?: string; sessionId?: string };

  if (!body.message || typeof body.message !== "string" || body.message.trim() === "") {
    return HttpNextResponse.badRequest("El campo 'message' es obligatorio.");
  }

  try {
    const result = await orchestrator.run(
      body.message.trim(),
      typeof body.sessionId === "string" ? body.sessionId : undefined,
    );
    return HttpNextResponse.json(result);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Error interno del agente.";
    return HttpNextResponse.internalError(message);
  }
}
